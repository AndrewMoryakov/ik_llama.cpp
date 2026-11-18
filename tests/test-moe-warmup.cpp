#include "llama.h"

#include <cstdio>
#include <memory>
#include <string_view>

static int capture_expert_count(ggml_tensor * tensor, bool ask, void * data) {
    if (!std::string_view(tensor->name).starts_with("ffn_moe_topk-")) {
        return false;
    }
    if (!ask) {
        *static_cast<int64_t *>(data) = tensor->ne[0];
    }
    return true;
}

int main(int argc, char ** argv) {
    if (argc != 2) {
        return 1;
    }
    llama_backend_init();
    auto model_params = llama_model_default_params();
    model_params.n_gpu_layers = 0;
    std::unique_ptr<llama_model, decltype(&llama_free_model)> model(
        llama_model_load_from_file(argv[1], model_params), llama_free_model);
    if (!model) {
        return 1;
    }

    int64_t routed = 0;
    auto params = llama_context_default_params();
    params.n_ctx = 128;
    params.n_batch = 32;
    params.n_ubatch = 32;
    params.n_threads = 1;
    params.n_threads_batch = 1;
    params.graph_reuse = true;
    params.cb_eval = capture_expert_count;
    params.cb_eval_user_data = &routed;
    std::unique_ptr<llama_context, decltype(&llama_free)> ctx(
        llama_init_from_model(model.get(), params), llama_free);
    if (!ctx) {
        return 1;
    }

    auto bos = llama_token_bos(model.get());
    for (int pos = 0; pos < 3; ++pos) {
        const bool warmup = pos == 1;
        llama_set_warmup(ctx.get(), warmup);
        routed = 0;
        if (llama_decode(ctx.get(), llama_batch_get_one(&bos, 1, pos, 0)) != 0 ||
                routed != (warmup ? 2 : 1)) {
            std::fprintf(stderr, "position %d, warmup %d: routed %lld experts\n",
                pos, warmup, static_cast<long long>(routed));
            return 1;
        }
    }
    return 0;
}
