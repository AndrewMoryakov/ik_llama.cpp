#include "llama.h"
#include <random>
#include "llama-context.h"
#include "ggml-backend.h"
#include "get-model.h"

#include <cmath>
#include <cstdio>
#include <memory>
#include <vector>

struct mask_snapshot {
    llama_context * ctx = nullptr;
    int64_t columns = 0;
    int64_t rows = 0;
    std::vector<float> values;
};

static int capture_mask(ggml_tensor *, bool ask, void * data) {
    // Capture inputs before the graph allocator can reuse their storage.
    auto & snapshot = *static_cast<mask_snapshot *>(data);
    if (!ask || !snapshot.values.empty() || !snapshot.ctx) return 0;
    auto * mask = snapshot.ctx->inp_KQ_mask;
    if (!mask) return 0;
    snapshot.columns = mask->ne[0];
    snapshot.rows = mask->ne[1];
    snapshot.values.resize(ggml_nelements(mask));
    if (mask->type == GGML_TYPE_F16) {
        std::vector<ggml_fp16_t> packed(snapshot.values.size());
        ggml_backend_tensor_get(mask, packed.data(), 0, ggml_nbytes(mask));
        ggml_fp16_to_fp32_row(packed.data(), snapshot.values.data(), snapshot.values.size());
    } else {
        ggml_backend_tensor_get(mask, snapshot.values.data(), 0, ggml_nbytes(mask));
    }
    return 0;
}

static bool check_batch(llama_context * ctx, int count, int start) {
    auto & snapshot = *static_cast<mask_snapshot *>(ctx->cparams.cb_eval_user_data);
    snapshot.values.clear();
    auto batch = llama_batch_init(count, 0, 2);
    for (int i = 0; i < count; ++i) {
        batch.token[i] = 1;
        batch.pos[i] = (start + i) / 2;
        batch.n_seq_id[i] = 1;
        batch.seq_id[i][0] = (start + i) % 2;
        batch.logits[i] = i == count - 1;
    }
    batch.n_tokens = count;
    bool ok = llama_decode(ctx, batch) == 0;
    if (ok && !snapshot.values.empty()) {
        for (int64_t row = 0; row < snapshot.rows && ok; ++row) {
            for (int64_t col = 0; col < snapshot.columns; ++col) {
                const auto & cell = ctx->kv_self.cells[col];
                const bool visible = row < count &&
                    cell.has_seq_id(batch.seq_id[row][0]) && cell.pos <= batch.pos[row];
                const float expected = visible ? 0.0f : -INFINITY;
                if (snapshot.values[row * snapshot.columns + col] != expected) {
                    std::fprintf(stderr, "mask mismatch at row %lld, column %lld\n",
                        static_cast<long long>(row), static_cast<long long>(col));
                    ok = false;
                    break;
                }
            }
        }
        if (count > 32 && snapshot.columns < 1024) {
            std::fprintf(stderr, "fixture did not reach the parallel mask path\n");
            ok = false;
        }
    } else {
        ok = false;
    }
    llama_batch_free(batch);
    return ok;
}

int main(int argc, char ** argv) {
    llama_backend_init();
    auto model_params = llama_model_default_params();
    model_params.n_gpu_layers = 0;
    std::unique_ptr<llama_model, decltype(&llama_free_model)> model(
        llama_model_load_from_file(get_model_or_exit(argc, argv), model_params), llama_free_model);
    if (!model) return 1;
    for (bool flash : {true, false}) {
        mask_snapshot snapshot;
        auto params = llama_context_default_params();
        params.n_ctx = 2048;
        params.n_batch = 2048;
        params.n_ubatch = 2048;
        params.n_seq_max = 2;
        params.n_threads = 2;
        params.n_threads_batch = 2;
        params.flash_attn = flash;
        params.cb_eval = capture_mask;
        params.cb_eval_user_data = &snapshot;
        std::unique_ptr<llama_context, decltype(&llama_free)> ctx(
            llama_init_from_model(model.get(), params), llama_free);
        snapshot.ctx = ctx.get();
        if (!ctx || !check_batch(ctx.get(), 1040, 0) ||
                !check_batch(ctx.get(), 31, 1040) || !check_batch(ctx.get(), 33, 1071)) return 1;
    }
    return 0;
}
