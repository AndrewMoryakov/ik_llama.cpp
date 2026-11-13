#include "ggml.h"

#include <cmath>
#include <cstdio>
#include <initializer_list>
#include <vector>

static bool check(int width, int columns) {
    constexpr int rows = 8;
    ggml_context * ctx = ggml_init({ 16 * 1024 * 1024, nullptr, false });
    if (!ctx) {
        return false;
    }
    auto * quant = ggml_new_tensor_2d(ctx, GGML_TYPE_NVFP4_KS, width, rows);
    ggml_set_input_scale(quant, 0.125f);
    auto * duplicate = ggml_dup_tensor(ctx, quant);
    auto * view = ggml_view_2d(ctx, quant, width, rows, quant->nb[1], 0);
    auto * plain = ggml_new_tensor_2d(ctx, GGML_TYPE_F32, width, rows);
    auto * input = ggml_new_tensor_2d(ctx, GGML_TYPE_F32, width, columns);
    std::vector<float> weights(width * rows);
    for (int r = 0; r < rows; ++r) {
        for (int i = 0; i < width; ++i) {
            weights[r * width + i] = r == 0 ? 0.0f : float(r) * std::sin(0.37f * float(i + r));
        }
    }
    const size_t bytes = ggml_quantize_chunk(GGML_TYPE_NVFP4_KS, weights.data(), quant->data,
                                              0, rows, width, nullptr, nullptr);
    bool ok = bytes == ggml_nbytes(quant) &&
              ggml_get_input_scale(duplicate) == 0.125f &&
              ggml_get_input_scale(view) == 0.125f &&
              quant->nb[1] == ggml_row_size(GGML_TYPE_NVFP4, width) + sizeof(float);
    const auto traits = ggml_internal_get_type_traits(GGML_TYPE_NVFP4_KS);
    auto * decoded = static_cast<float *>(plain->data);
    for (int r = 0; r < rows; ++r) {
        traits.to_float(static_cast<char *>(quant->data) + r * quant->nb[1], decoded + r * width, width);
    }
    auto * activations = static_cast<float *>(input->data);
    for (int i = 0; i < width * columns; ++i) {
        activations[i] = float(i % 9 - 4);
    }
    auto * expected = ggml_mul_mat(ctx, plain, input);
    auto * actual = ggml_mul_mat(ctx, quant, input);
    auto * graph = ggml_new_graph(ctx);
    ggml_build_forward_expand(graph, expected);
    ggml_build_forward_expand(graph, actual);
    ok = ok && ggml_graph_compute_with_ctx(ctx, graph, 2) == GGML_STATUS_SUCCESS;
    auto * a = static_cast<float *>(actual->data);
    auto * e = static_cast<float *>(expected->data);
    for (int c = 0; ok && c < columns; ++c) {
        for (int r = 0; ok && r < rows; ++r) {
            float norm = 0;
            for (int i = 0; i < width; ++i) {
                norm += std::fabs(decoded[r * width + i] * activations[c * width + i]);
            }
            const int j = c * rows + r;
            ok = std::isfinite(a[j]) && std::fabs(a[j] - e[j]) <= 0.02f * norm + 1e-5f;
            if (!ok) {
                std::fprintf(stderr, "NVFP4 width=%d columns=%d row=%d: expected %g, got %g\n",
                             width, columns, r, e[j], a[j]);
            }
        }
    }
    ggml_free(ctx);
    return ok;
}

int main() {
    for (int width : { 64, 128, 256 }) {
        for (int columns : { 1, 3, 8 }) {
            if (!check(width, columns)) {
                return 1;
            }
        }
    }
    std::puts("NVFP4_KS row metadata and CPU GEMM/GEMV passed in 9 cases");
    return 0;
}
