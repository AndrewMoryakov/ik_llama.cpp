#include "ggml.h"
#include <cmath>
#include <cstdio>
#include <cstring>
#include <initializer_list>

static bool fused(int width, int rows, int streams) {
    auto * ctx = ggml_init({1024*1024, nullptr, false});
    auto * gate = ggml_new_tensor_2d(ctx, GGML_TYPE_F32, width*streams, rows);
    auto * up = ggml_dup_tensor(ctx, gate);
    auto * g = (float *) gate->data;
    auto * u = (float *) up->data;
    for (int i = 0; i < width*streams*rows; ++i) {
        g[i] = 0.17f * (i % 13 - 6);
        u[i] = 0.23f * (i % 17 - 8);
    }
    auto * out = ggml_multi_add_unary_scale(ctx, gate, up, streams, 1.0f/streams, GGML_UNARY_OP_SIGMOID);
    auto * graph = ggml_new_graph(ctx);
    ggml_build_forward_expand(graph, out);
    bool ok = ggml_graph_compute_with_ctx(ctx, graph, 3) == GGML_STATUS_SUCCESS;
    for (int r = 0; r < rows; ++r) for (int c = 0; c < width; ++c) {
        float expected = 0;
        for (int s = 0; s < streams; ++s) {
            int i = r*width*streams + s*width + c;
            expected += u[i] / (1.0f + std::exp(-g[i]));
        }
        expected /= streams;
        ok &= std::abs(((float *)out->data)[r*width+c] - expected) < 1e-5f;
    }
    ggml_free(ctx);
    return ok;
}

static bool quantized_copy() {
    auto * ctx = ggml_init({1024*1024, nullptr, false});
    auto * src = ggml_new_tensor_2d(ctx, GGML_TYPE_Q4_0, 64, 3);
    auto * bytes = (unsigned char *) src->data;
    for (size_t i = 0; i < ggml_nbytes(src); ++i) bytes[i] = (unsigned char) (i*37+11);
    auto * dst = ggml_dup(ctx, src);
    auto * graph = ggml_new_graph(ctx);
    ggml_build_forward_expand(graph, dst);
    bool ok = ggml_graph_compute_with_ctx(ctx, graph, 3) == GGML_STATUS_SUCCESS &&
        std::memcmp(src->data, dst->data, ggml_nbytes(src)) == 0;
    ggml_free(ctx);
    return ok;
}

int main() {
    bool ok = quantized_copy();
    for (int w : {64, 128, 192}) for (int r : {1, 3}) for (int s : {2, 4}) ok &= fused(w, r, s);
    if (!ok) std::fprintf(stderr, "quantized copy or fused mixer numerical regression\n");
    return ok ? 0 : 1;
}
