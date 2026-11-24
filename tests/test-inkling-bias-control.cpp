#include "ggml.h"
#include <algorithm>
#include <cmath>
#include <cstdio>

int main() {
    auto * ctx = ggml_init({4*1024*1024, nullptr, false});
    constexpr int R = 5, E = 4, H = 2, T = 3, PAD = 32;
    auto * w = ggml_new_tensor_2d(ctx, GGML_TYPE_F32, R, E);
    auto * r = ggml_new_tensor_3d(ctx, GGML_TYPE_F32, R, H, T);
    auto * sink = ggml_new_tensor_3d(ctx, GGML_TYPE_F32, 1, H, T);
    for (int i = 0; i < R*E; ++i) ((float *)w->data)[i] = (i%7-3)*0.125f;
    for (int i = 0; i < R*H*T; ++i) ((float *)r->data)[i] = (i%11-5)*0.0625f;
    for (int i = 0; i < H*T; ++i) ((float *)sink->data)[i] = i*0.125f;
    auto * padded = ggml_pad(ctx, w, 0, PAD-E, 0, 0);
    auto * column = ggml_fill(ctx, ggml_new_tensor_2d(ctx, GGML_TYPE_F32, 1, PAD), -1.0f);
    column = ggml_pad(ctx, column, 2, 0, 0, 0);
    auto * weights = ggml_concat(ctx, padded, column, 0);
    auto * rs = ggml_pad(ctx, ggml_concat(ctx, r, sink, 0), 2, 0, 0, 0);
    auto * table = ggml_mul_mat(ctx, weights, rs);

    constexpr int N = 64;
    auto * f = ggml_new_tensor_1d(ctx, GGML_TYPE_F32, N);
    auto * g = ggml_dup_tensor(ctx, f);
    auto * dest = ggml_dup_tensor(ctx, f);
    auto * message = ggml_dup_tensor(ctx, f);
    for (int i = 0; i < N; ++i) {
        ((float *)f->data)[i] = i == 0 ? 100.0f : (i%13-6)*0.25f;
        ((float *)g->data)[i] = i == 0 ? 100.0f : (i%17-8)*0.25f;
        ((float *)dest->data)[i] = (i%7-3)*0.25f;
        ((float *)message->data)[i] = (i%11-5)*0.25f;
    }
    auto * keep = ggml_scale_bias(ctx, ggml_tanh(ctx, f), -1.0f, 1.0f);
    ggml_set_output(keep);
    auto * left = ggml_mul(ctx, keep, dest);
    auto * right = ggml_mul(ctx, ggml_tanh(ctx, g), message);
    auto * blend = ggml_add(ctx, left, right);
    auto * other = ggml_add(ctx, keep, keep);
    auto * graph = ggml_new_graph(ctx);
    ggml_build_forward_expand(graph, table);
    ggml_build_forward_expand(graph, blend);
    ggml_build_forward_expand(graph, other);
    bool ok = ggml_graph_compute_with_ctx(ctx, graph, 4) == GGML_STATUS_SUCCESS;
    for (int row = 0; row < H*T; ++row) for (int e = 0; e < PAD; ++e) {
        float expected = -((float *)sink->data)[row];
        if (e < E) for (int j = 0; j < R; ++j) expected += ((float *)w->data)[e*R+j]*((float *)r->data)[row*R+j];
        ok &= std::abs(((float *)table->data)[row*PAD+e] - expected) < 1e-6f;
    }
    for (int i = 0; i < N; ++i) {
        float k = 1.0f-std::tanh(((float *)f->data)[i]);
        float expected = k*((float *)dest->data)[i] + std::tanh(((float *)g->data)[i])*((float *)message->data)[i];
        ok &= std::isfinite(((float *)blend->data)[i]) && std::abs(((float *)blend->data)[i] - expected) < 1e-6f;
        ok &= std::abs(((float *)keep->data)[i]-k) < 1e-6f;
        ok &= std::abs(((float *)other->data)[i]-2*k) < 1e-6f;
    }
    ggml_free(ctx);
    if (!ok) std::fprintf(stderr, "Inkling padded bias or retained control graph mismatch\n");
    return ok ? 0 : 1;
}
