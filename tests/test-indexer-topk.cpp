#include "ggml.h"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <initializer_list>
#include <vector>

static bool check(int count, float center, float spread, int mode, int group, int threads) {
    constexpr int top = 2048;
    ggml_context * ctx = ggml_init({ 32 * 1024 * 1024, nullptr, false });
    if (!ctx) {
        return false;
    }
    auto * keys = ggml_new_tensor_2d(ctx, GGML_TYPE_F32, 32, count);
    auto * query = ggml_new_tensor_3d(ctx, GGML_TYPE_F32, 32, 1, 1);
    auto * weights = ggml_new_tensor_2d(ctx, GGML_TYPE_F32, 1, 1);
    auto * mask = ggml_new_tensor_2d(ctx, GGML_TYPE_F32, count, 1);
    ggml_set_zero(keys);
    ggml_set_zero(query);
    ggml_set_f32(weights, 1.0f);
    std::vector<float> scores(count);
    uint32_t state = 12345;
    for (int i = 0; i < count; ++i) {
        state = 1664525u * state + 1013904223u;
        scores[i] = center + spread * (float(state >> 8) / 16777216.0f);
        const bool hidden = mode == 1 ? (i % 2 == 0) :
                            mode == 2 ? ((i / group) * 37 % (count / group) >= 64) :
                            mode == 3 ? (i == 13) : false;
        if (hidden) {
            scores[i] = -INFINITY;
        }
    }
    std::copy(scores.begin(), scores.end(), static_cast<float *>(mask->data));
    auto reference = scores;
    std::nth_element(reference.begin(), reference.begin() + top - 1, reference.end(),
                     [](float a, float b) { return a > b; });
    const float cutoff = reference[top - 1];
    auto * selected = ggml_indexer_topk(ctx, keys, query, weights, mask, nullptr,
                                      GGML_UNARY_OP_RELU, top, 0, false, nullptr);
    auto * graph = ggml_new_graph(ctx);
    ggml_build_forward_expand(graph, selected);
    bool ok = ggml_graph_compute_with_ctx(ctx, graph, threads) == GGML_STATUS_SUCCESS;
    std::vector<bool> seen(count, false);
    auto * indices = static_cast<int32_t *>(selected->data);
    for (int i = 0; ok && i < top; ++i) {
        const int index = indices[i];
        ok = index >= 0 && index < count && !seen[index] && scores[index] >= cutoff;
        if (ok) {
            seen[index] = true;
        } else {
            std::fprintf(stderr, "wrong top-k index %d at rank %d (cutoff %.9g)\n", index, i, cutoff);
        }
    }
    if (!ok) {
        std::fprintf(stderr, "count=%d center=%g spread=%g mask=%d group=%d threads=%d\n",
                     count, center, spread, mode, group, threads);
    }
    ggml_free(ctx);
    return ok;
}

int main() {
    // Two threads and one query exercise the bucket path; one thread uses
    // partial_sort. Ties at the cutoff may select any distinct index.
    for (int threads : { 1, 2 }) {
        for (int mask : { 0, 3 }) {
            const float centers[] = { 1e4f, 1e5f, 2.5e6f };
            const float spreads[] = { 0.01f, 0.1f, 1.0f };
            for (int scale = 0; scale < 3; ++scale) {
                if (!check(8192, centers[scale], spreads[scale], mask, 0, threads)) {
                    return 1;
                }
            }
        }
        for (int count : { 16384, 65536 }) {
            for (int group : { 64, 128 }) {
                if (!check(count, 0.0f, 10.0f, 2, group, threads)) {
                    return 1;
                }
            }
        }
        for (int count : { 8192, 32768 }) {
            if (!check(count, 0.0f, 10.0f, 1, 0, threads)) {
                return 1;
            }
        }
    }
    std::puts("Indexer top-k matches reference cutoff in 24 CPU cases");
    return 0;
}
