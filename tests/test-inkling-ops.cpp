#include "ggml.h"
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <initializer_list>

int main() {
    auto * ctx = ggml_init({4*1024*1024, nullptr, false});
    bool ok = true;
    auto * base = ggml_new_tensor_3d(ctx, GGML_TYPE_F32, 9, 2, 2);
    for (int i = 0; i < 36; ++i) ((float *)base->data)[i] = (i % 11 - 5)*0.25f;
    auto * input = ggml_view_3d(ctx, base, 5, 2, 2, base->nb[1], base->nb[2], 0);
    auto * clip = ggml_inkling2_clip(ctx, input, 0.5f, 0.25f, 0.7f, 0.1f, 1.0f);
    auto * graph = ggml_new_graph(ctx);
    ggml_build_forward_expand(graph, clip);
    ok &= ggml_graph_compute_with_ctx(ctx, graph, 3) == GGML_STATUS_SUCCESS;
    for (int row = 0; row < 4; ++row) {
        const auto * x = (const float *)base->data + 9*row;
        float sum = 0;
        for (int j = 0; j < 5; ++j) sum += x[j]*x[j];
        float factor = std::clamp(0.7f/(0.5f*std::sqrt(sum)+0.25f), 0.1f, 1.0f);
        for (int j = 0; j < 5; ++j) ok &= std::abs(((float *)clip->data)[row*5+j] - factor*x[j]) < 1e-6f;
    }
    for (int width : {8, 128}) {
    auto * q = ggml_new_tensor_3d(ctx, GGML_TYPE_F32, width, 2, 1);
    auto * k = ggml_new_tensor_3d(ctx, GGML_TYPE_F32, width, 3, 1);
    auto * v = ggml_dup_tensor(ctx, k);
    for (int i = 0; i < 2*width; ++i) ((float *)q->data)[i] = 0.02f*(i%17-7);
    for (int i = 0; i < 3*width; ++i) {
        ((float *)k->data)[i] = 0.03f*(i%19-10);
        ((float *)v->data)[i] = 0.05f*(i%23-8);
    }
    auto * table = ggml_new_tensor_3d(ctx, GGML_TYPE_F32, 3, 1, 2);
    auto * pq = ggml_new_tensor_1d(ctx, GGML_TYPE_I32, 2);
    auto * pk = ggml_new_tensor_1d(ctx, GGML_TYPE_I32, 3);
    ((int32_t *)pq->data)[0] = 1; ((int32_t *)pq->data)[1] = 4;
    ((int32_t *)pk->data)[0] = 0; ((int32_t *)pk->data)[1] = 2; ((int32_t *)pk->data)[2] = 5;
    for (int i = 0; i < 6; ++i) ((float *)table->data)[i] = 0.1f*(i-2);
    auto * attn = ggml_flash_attn_ext(ctx, q, k, v, nullptr, 0.5f, 0.0f, 0.0f);
    ggml_flash_attn_ext_add_rel_bias(attn, table, pq, pk);
    auto * ag = ggml_new_graph(ctx);
    ggml_build_forward_expand(ag, attn);
    ok &= ggml_graph_compute_with_ctx(ctx, ag, 3) == GGML_STATUS_SUCCESS;
    for (int row = 0; row < 2; ++row) {
        float weights[3], total = 0;
        for (int key = 0; key < 3; ++key) {
            float dot = 0;
            for (int d = 0; d < width; ++d) dot += ((float *)q->data)[row*width+d]*((float *)k->data)[key*width+d];
            int delta = ((int32_t *)pq->data)[row] - ((int32_t *)pk->data)[key];
            int bucket = delta >= 0 ? std::min(delta, 2) : 2;
            weights[key] = std::exp(0.5f*dot + ((float *)table->data)[row*3+bucket]);
            total += weights[key];
        }
        for (int d = 0; d < width; ++d) {
            float expected = 0;
            for (int key = 0; key < 3; ++key) expected += weights[key]*((float *)v->data)[key*width+d]/total;
            ok &= std::abs(((float *)attn->data)[row*width+d] - expected) < 1e-5f;
        }
    }
    }
    ggml_free(ctx);
    if (!ok) std::fprintf(stderr, "Inkling clip or relative bias reference mismatch\n");
    return ok ? 0 : 1;
}
