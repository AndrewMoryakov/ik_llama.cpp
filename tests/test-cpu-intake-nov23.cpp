#include "ggml.h"
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <initializer_list>

static bool clamp_rows(int threads) {
    auto * ctx = ggml_init({1024*1024, nullptr, false});
    auto * x = ggml_new_tensor_2d(ctx, GGML_TYPE_F32, 5, 17);
    for (int i = 0; i < 85; ++i) ((float *)x->data)[i] = (i%13-6)*0.5f;
    auto * y = ggml_clamp(ctx, x, -0.75f, 0.75f);
    // clamp aliases x. A parallel consumer keeps the graph worker count above
    // one; a graph containing only clamp is planned with one worker.
    auto * out = ggml_add(ctx, y, y);
    ggml_set_f32(out, 123.0f);
    auto * g = ggml_new_graph(ctx); ggml_build_forward_expand(g, out);
    bool ok = ggml_graph_compute_with_ctx(ctx, g, threads) == GGML_STATUS_SUCCESS;
    for (int i = 0; i < 85; ++i) ok &= ((float *)out->data)[i] == 2*std::clamp((i%13-6)*0.5f, -0.75f, 0.75f);
    ggml_free(ctx); return ok;
}

static bool mix(int width) {
    auto * ctx = ggml_init({1024*1024, nullptr, false});
    auto * a = ggml_new_tensor_2d(ctx, GGML_TYPE_F32, width, 5);
    auto * logits = ggml_new_tensor_2d(ctx, GGML_TYPE_F32, width, 2);
    for (int i = 0; i < width*5; ++i) ((float *)a->data)[i] = (i%11-5)*0.2f;
    for (int i = 0; i < width*2; ++i) ((float *)logits->data)[i] = (i%7-2)*0.4f;
    auto * probabilities = ggml_soft_max_ext(ctx, logits, nullptr, 0.7f, 0.0f);
    ggml_set_f32(probabilities, -77.0f);
    ggml_set_output(probabilities);
    auto * out = ggml_mul_mat(ctx, a, probabilities);
    auto * g = ggml_new_graph(ctx); ggml_build_forward_expand(g, out);
    bool ok = ggml_graph_compute_with_ctx(ctx, g, 3) == GGML_STATUS_SUCCESS;
    for (int q = 0; q < 2; ++q) {
        float total = 0;
        for (int j = 0; j < width; ++j) total += std::exp(0.7f*((float *)logits->data)[q*width+j]);
        for (int j = 0; j < width; ++j) ok &= std::abs(((float *)probabilities->data)[q*width+j] - std::exp(0.7f*((float *)logits->data)[q*width+j])/total) < 1e-6f;
        for (int r = 0; r < 5; ++r) {
            float expected = 0;
            for (int j = 0; j < width; ++j) expected += ((float *)a->data)[r*width+j]*std::exp(0.7f*((float *)logits->data)[q*width+j])/total;
            ok &= std::abs(((float *)out->data)[q*5+r] - expected) < 1e-5f;
        }
    }
    ggml_free(ctx); return ok;
}

static bool gqa_three() {
    constexpr int D = 128, NQ = 5, NK = 32, H = 3;
    auto * ctx = ggml_init({2*1024*1024, nullptr, false});
    auto * q = ggml_new_tensor_3d(ctx, GGML_TYPE_F32, D, NQ, H);
    auto * k = ggml_new_tensor_3d(ctx, GGML_TYPE_F16, D, NK, 1);
    auto * v = ggml_dup_tensor(ctx, k);
    for (int i = 0; i < D*NQ*H; ++i) ((float *)q->data)[i] = (i%17-8)/32.0f;
    for (int i = 0; i < D*NK; ++i) {
        ((ggml_fp16_t *)k->data)[i] = ggml_fp32_to_fp16((i%19-9)/64.0f);
        ((ggml_fp16_t *)v->data)[i] = ggml_fp32_to_fp16((i%23-11)/32.0f);
    }
    auto * y = ggml_flash_attn_ext(ctx, q, k, v, nullptr, 0.5f, 0.0f, 0.0f);
    ggml_set_f32(y, -99.0f);
    auto * g = ggml_new_graph(ctx); ggml_build_forward_expand(g, y);
    bool ok = ggml_graph_compute_with_ctx(ctx, g, 4) == GGML_STATUS_SUCCESS;
    for (int h = 0; h < H; ++h) for (int query = 0; query < NQ; ++query) {
        float weights[NK], total = 0;
        for (int key = 0; key < NK; ++key) {
            float dot = 0;
            for (int d = 0; d < D; ++d) dot += ((float *)q->data)[(h*NQ+query)*D+d]*ggml_fp16_to_fp32(((ggml_fp16_t *)k->data)[key*D+d]);
            weights[key] = std::exp(0.5f*dot); total += weights[key];
        }
        for (int d = 0; d < D; ++d) {
            float expected = 0;
            for (int key = 0; key < NK; ++key) expected += weights[key]*ggml_fp16_to_fp32(((ggml_fp16_t *)v->data)[key*D+d])/total;
            float error = std::abs(((float *)y->data)[(query*H+h)*D+d] - expected);
            if (error >= 1e-3f && d == 0) std::fprintf(stderr, "GQA head %d query %d: got %g expected %g\n", h, query, ((float *)y->data)[(query*H+h)*D+d], expected);
            ok &= error < 1e-3f;
        }
    }
    ggml_free(ctx); return ok;
}

int main() {
    bool ok = gqa_three();
    if (!ok) std::fprintf(stderr, "GQA=3 reference mismatch\n");
    for (int threads : {1, 2, 4, 8}) {
        bool passed = clamp_rows(threads);
        if (!passed) std::fprintf(stderr, "clamp with %d threads failed\n", threads);
        ok &= passed;
    }
    for (int width : {1, 3, 7}) {
        bool passed = mix(width);
        if (!passed) std::fprintf(stderr, "softmax/matmul width %d failed\n", width);
        ok &= passed;
    }
    if (!ok) std::fprintf(stderr, "clamp, GQA=3 or softmax/matmul reference mismatch\n");
    return ok ? 0 : 1;
}
