#include "ggml.h"

#include <array>
#include <atomic>
#include <cstdint>
#include <cstring>
#include <thread>
#include <vector>

int main(int argc, char **) {
    if (argc > 1) {
        ggml_init({SIZE_MAX, nullptr, false});
        return 1;
    }
    std::vector<ggml_context *> contexts;
    for (int i = 0; i < 256; ++i) {
        auto * ctx = ggml_init({1024, nullptr, false});
        if (!ctx || !ggml_new_tensor_1d(ctx, GGML_TYPE_F32, 8)) return 1;
        contexts.push_back(ctx);
    }
    for (auto * ctx : contexts) ggml_free(ctx);

    alignas(GGML_MEM_ALIGN) std::array<unsigned char, 2048> external{};
    auto * ctx = ggml_init({external.size(), external.data(), false});
    if (ggml_get_mem_buffer(ctx) != external.data()) return 1;
    auto * tensor = ggml_new_tensor_1d(ctx, GGML_TYPE_F32, 8);
    if (!tensor || reinterpret_cast<uintptr_t>(tensor->data) % GGML_MEM_ALIGN) return 1;
    ggml_free(ctx);
    std::memset(external.data(), 0x5a, external.size());
    std::atomic<bool> ok{true};
    std::vector<std::thread> workers;
    for (int i = 0; i < 8; ++i) {
        workers.emplace_back([&ok] {
            for (int j = 0; j < 1000; ++j) {
                auto * current = ggml_init({0, nullptr, true});
                if (!current) ok = false;
                ggml_free(current);
            }
        });
    }
    for (auto & worker : workers) worker.join();
    ggml_free(nullptr);
    return ok ? 0 : 1;
}
