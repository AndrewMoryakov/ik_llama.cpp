#include "ggml.h"

#include <cmath>
#include <cstdio>
#include <initializer_list>

static void fill(ggml_tensor * tensor, float phase) {
    auto * values = static_cast<float *>(tensor->data);
    for (int64_t i = 0; i < ggml_nelements(tensor); ++i) {
        values[i] = std::sin(0.37f * float(i + 1) + phase);
    }
}

static bool same(const float * expected, const float * actual, int64_t size) {
    for (int64_t i = 0; i < size; ++i) {
        if (!std::isfinite(actual[i]) || std::fabs(expected[i] - actual[i]) > 1e-6f) {
            std::fprintf(stderr, "element %lld: expected %.9g, got %.9g\n",
                         static_cast<long long>(i), expected[i], actual[i]);
            return false;
        }
    }
    return true;
}

static bool check(int streams, int tokens, int threads, float eps) {
    ggml_init_params params = { 8 * 1024 * 1024, nullptr, false };
    ggml_context * ctx = ggml_init(params);
    if (!ctx) {
        return false;
    }
    const int width = streams * streams + 2 * streams;
    auto * mixes = ggml_new_tensor_2d(ctx, GGML_TYPE_F32, width, tokens);
    auto * scale = ggml_new_tensor_1d(ctx, GGML_TYPE_F32, 3);
    auto * bias = ggml_new_tensor_1d(ctx, GGML_TYPE_F32, width);
    auto * x = ggml_new_tensor_2d(ctx, GGML_TYPE_F32, 16, tokens);
    auto * residual = ggml_new_tensor_3d(ctx, GGML_TYPE_F32, 16, streams, tokens);
    fill(mixes, 0.2f);
    fill(scale, 0.6f);
    fill(bias, 1.1f);
    fill(x, 1.7f);
    fill(residual, 2.3f);

    auto * original = ggml_hc_pre(ctx, mixes, scale, bias, streams, 3, eps);
    auto * fused = ggml_hc_pre(ctx, mixes, scale, bias, streams, 3, eps);
    fused->op_params[3] = 1;

    const size_t post_offset = streams * tokens * sizeof(float);
    const size_t comb_offset = 2 * post_offset;
    const size_t row_bytes = streams * sizeof(float);
    const size_t matrix_bytes = streams * row_bytes;
    auto * original_comb = ggml_view_3d(ctx, original, streams, streams, tokens,
                                      row_bytes, matrix_bytes, comb_offset);
    // The explicit permutation was the Xing4 graph before upstream #2848.
    auto * expected_comb = ggml_cont(ctx, ggml_permute(ctx, original_comb, 1, 0, 2, 3));
    auto * actual_comb = ggml_view_3d(ctx, fused, streams, streams, tokens,
                                    row_bytes, matrix_bytes, comb_offset);
    auto * original_post = ggml_view_2d(ctx, original, streams, tokens, row_bytes, post_offset);
    auto * fused_post = ggml_view_2d(ctx, fused, streams, tokens, row_bytes, post_offset);
    auto * expected = ggml_hc_post(ctx, x, original_post, residual, expected_comb);
    auto * actual = ggml_hc_post(ctx, x, fused_post, residual, actual_comb);

    auto * graph = ggml_new_graph(ctx);
    ggml_build_forward_expand(graph, expected);
    ggml_build_forward_expand(graph, actual);
    const bool ok = ggml_graph_compute_with_ctx(ctx, graph, threads) == GGML_STATUS_SUCCESS &&
        same(static_cast<float *>(original->data), static_cast<float *>(fused->data), 2 * streams * tokens) &&
        same(static_cast<float *>(expected_comb->data), static_cast<float *>(actual_comb->data), streams * streams * tokens) &&
        same(static_cast<float *>(expected->data), static_cast<float *>(actual->data), ggml_nelements(expected));
    if (!ok) {
        std::fprintf(stderr, "streams=%d tokens=%d threads=%d eps=%g\n", streams, tokens, threads, eps);
    }
    ggml_free(ctx);
    return ok;
}

int main() {
    for (int streams = 1; streams <= 8; ++streams) {
        for (int tokens : { 1, 5 }) {
            for (int threads : { 1, 3 }) {
                for (float eps : { 0.0f, 1e-6f }) {
                    if (!check(streams, tokens, threads, eps)) {
                        return 1;
                    }
                }
            }
        }
    }
    std::puts("HC_PRE transpose matches explicit permutation and HC_POST in 64 CPU cases");
    return 0;
}
