#include "llama-model.h"
#include <chrono>
#include <cstdlib>
#include <filesystem>
#include <string>

int main() {
    const char * fixture = std::getenv("LLAMACPP_TEST_MODELFILE");
    if (!fixture) return 77;
    ggml_context * tensors = nullptr;
    auto * input = gguf_init_from_file(fixture, {false, &tensors});
    if (!input) return 1;
    auto * tied = gguf_init_empty();
    gguf_set_kv(tied, input);
    for (int i = 0; i < gguf_get_n_tensors(input); ++i) {
        const char * name = gguf_get_tensor_name(input, i);
        if (std::string(name) != "output.weight") gguf_add_tensor(tied, ggml_get_tensor(tensors, name));
    }
    const auto file = std::filesystem::temp_directory_path() /
        ("ik-tied-" + std::to_string(std::chrono::steady_clock::now().time_since_epoch().count()) + ".gguf");
    gguf_write_to_file(tied, file.string().c_str(), false);
    gguf_free(tied); gguf_free(input); ggml_free(tensors);
    auto params = llama_model_default_params();
    params.n_gpu_layers = 0;
    params.use_mmap = false;
    auto * model = llama_model_load_from_file(file.string().c_str(), params);
    const bool ok = model && model->tok_embd && model->output == model->tok_embd;
    if (model) llama_free_model(model);
    std::filesystem::remove(file);
    return ok ? 0 : 1;
}
