#include "llama-model-loader.h"
#include <chrono>
#include <cstdio>
#include <cstring>
#include <filesystem>
#include <vector>

int main() {
    const auto file = std::filesystem::temp_directory_path() /
        ("ik-expert-scale-" + std::to_string(std::chrono::steady_clock::now().time_since_epoch().count()) + ".gguf");
    auto * ctx = ggml_init({1024*1024, nullptr, false});
    const auto type = GGML_TYPE_Q2_0;
    auto * w = ggml_new_tensor_3d(ctx, type, ggml_blck_size(type), 1, 2);
    ggml_set_name(w, "blk.0.ffn_up_exps.weight");
    std::memset(w->data, 0, ggml_nbytes(w));
    const ggml_fp16_t one = ggml_fp32_to_fp16(1.0f);
    for (int e = 0; e < 2; ++e) std::memcpy((char *)w->data + e*w->nb[2], &one, sizeof(one));
    auto * scale = ggml_new_tensor_1d(ctx, GGML_TYPE_F32, 2);
    ggml_set_name(scale, "blk.0.ffn_up_exps.scale");
    ((float *)scale->data)[0] = 2.0f; ((float *)scale->data)[1] = 3.0f;
    auto * gguf = gguf_init_empty();
    gguf_set_val_str(gguf, "general.architecture", "inkling2_loop");
    gguf_add_tensor(gguf, w); gguf_add_tensor(gguf, scale);
    gguf_write_to_file(gguf, file.string().c_str(), false);
    gguf_free(gguf);
    bool ok = true;
    {
        llama_model_loader loader(file.string(), 0, true, false, false, false,
                false, false, false, nullptr, nullptr);
        auto * weight = loader.get_weight("blk.0.ffn_up_exps.weight");
        ok &= weight && !loader.use_mmap && loader.n_tensors == 1;
        if (weight) {
            std::vector<uint8_t> bytes(ggml_nbytes(weight->tensor));
            weight->tensor->data = bytes.data();
            for (int reload = 0; reload < 2; ++reload) {
                loader.load_data_for(weight->tensor);
                for (int e = 0; e < 2; ++e) {
                    ggml_fp16_t d;
                    std::memcpy(&d, bytes.data() + e*weight->tensor->nb[2], sizeof(d));
                    ok &= ggml_fp16_to_fp32(d) == (e == 0 ? 2.0f : 3.0f);
                }
            }
        }
    }
    ggml_free(ctx);
    std::filesystem::remove(file);
    if (!ok) std::fprintf(stderr, "expert scales not preserved after rereading source bytes\n");
    return ok ? 0 : 1;
}
