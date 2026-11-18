#include "ggml.h"
#include "ggml-backend.h"

#include <array>
#include <cmath>
#include <cstring>
#include <vector>

static bool check(ggml_type type) {
    constexpr int width = 256, rows = 2, columns = 3;
    auto * ctx = ggml_init({65536, nullptr, true});
    auto * a = ggml_new_tensor_2d(ctx, type, width, rows);
    auto * b = ggml_new_tensor_2d(ctx, GGML_TYPE_F32, width, columns);
    auto * out = ggml_mul_mat(ctx, a, b);
    auto * graph = ggml_new_graph_custom(ctx, 16, false);
    ggml_build_forward_expand(graph, out);
    auto * backend = ggml_backend_cpu_init();
    auto * buffer = ggml_backend_alloc_ctx_tensors(ctx, backend);
    if (!buffer) return false;
    std::vector<unsigned char> packed(ggml_nbytes(a), 0);
    std::vector<float> inputs(width * columns);
    std::array<float, rows * columns> expected{}, actual{};
    const unsigned char codes[] = {0xc0, 0xb8, 0, 0x38, 0x40};
    for (int row = 0; row < rows; ++row) {
        const float scale = row == 0 ? 0.5f : 2.0f;
        auto * bytes = packed.data() + row * a->nb[1];
        if (type == GGML_TYPE_F8_E4M3_KS) std::memcpy(bytes, &scale, sizeof(scale));
        for (int k = 0; k < width; ++k) {
            const int value = (k + row) % 5 - 2;
            if (type == GGML_TYPE_F8_E4M3_KS) {
                bytes[16 + k] = codes[value + 2];
            } else {
                if (k % 128 == 0) std::memcpy(bytes + k / 128 * 132, &scale, sizeof(scale));
                bytes[k / 128 * 132 + 4 + k % 128] = codes[value + 2];
            }
            for (int col = 0; col < columns; ++col) {
                const float input = (k + 2 * col) % 7 - 3;
                inputs[col * width + k] = input;
                expected[col * rows + row] += scale * value * input;
            }
        }
    }
    ggml_backend_tensor_set(a, packed.data(), 0, packed.size());
    ggml_backend_tensor_set(b, inputs.data(), 0, inputs.size() * sizeof(float));
    bool ok = ggml_backend_graph_compute(backend, graph) == GGML_STATUS_SUCCESS;
    ggml_backend_tensor_get(out, actual.data(), 0, sizeof(actual));
    for (int i = 0; i < rows * columns; ++i) ok &= std::abs(actual[i] - expected[i]) < 0.01f;
    ggml_backend_buffer_free(buffer);
    ggml_backend_free(backend);
    ggml_free(ctx);
    return ok;
}

int main() {
    return check(GGML_TYPE_F8_E4M3_KS) && check(GGML_TYPE_F8_E4M3_B128) ? 0 : 1;
}
