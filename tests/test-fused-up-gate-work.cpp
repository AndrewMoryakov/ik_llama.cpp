#include "ggml.h"

#include <cstdio>

static bool check_dense(ggml_context * ctx) {
    constexpr int64_t width = 64;
    constexpr int64_t outputs = 16;
    constexpr int64_t tokens = 64;
    auto * up = ggml_new_tensor_2d(ctx, GGML_TYPE_Q8_0, width, outputs);
    auto * gate = ggml_new_tensor_2d(ctx, GGML_TYPE_Q8_0, width, outputs);
    auto * activations = ggml_new_tensor_2d(ctx, GGML_TYPE_F32, width, tokens);
    auto * result = ggml_fused_up_gate(ctx, up, gate, activations, GGML_UNARY_OP_SILU);
    auto * graph = ggml_new_graph(ctx);
    ggml_build_forward_expand(graph, result);
    const auto plan = ggml_graph_plan(graph, 1);
    const size_t conversion = ggml_row_size(GGML_TYPE_Q8_0, width) * tokens;
    if (plan.work_size < conversion) {
        std::fprintf(stderr, "dense fused up/gate work buffer: got %zu, need at least %zu\n",
                     plan.work_size, conversion);
        return false;
    }
    return true;
}

static bool check_moe_merged(ggml_context * ctx) {
    constexpr int64_t width = 64;
    constexpr int64_t merged_outputs = 32;
    constexpr int64_t experts = 4;
    constexpr int64_t tokens = 64;
    auto * up_gate = ggml_new_tensor_3d(ctx, GGML_TYPE_Q8_0, width, merged_outputs, experts);
    auto * activations = ggml_new_tensor_3d(ctx, GGML_TYPE_F32, width, 1, tokens);
    auto * ids = ggml_new_tensor_2d(ctx, GGML_TYPE_I32, 1, tokens);
    auto * result = ggml_moe_up_gate(ctx, up_gate, nullptr, activations, ids, GGML_UNARY_OP_SILU);
    auto * graph = ggml_new_graph(ctx);
    ggml_build_forward_expand(graph, result);
    const auto plan = ggml_graph_plan(graph, 1);
    const size_t conversion = ggml_row_size(GGML_TYPE_Q8_0, width) * tokens;
    if (plan.work_size < conversion) {
        std::fprintf(stderr, "merged MoE up/gate work buffer: got %zu, need at least %zu\n",
                     plan.work_size, conversion);
        return false;
    }
    return true;
}

int main() {
    ggml_context * ctx = ggml_init({ 2 * 1024 * 1024, nullptr, false });
    if (!ctx) return 1;
    const bool ok = check_dense(ctx) && check_moe_merged(ctx);
    ggml_free(ctx);
    if (ok) std::puts("fused up/gate work buffers cover all converted activation rows");
    return ok ? 0 : 1;
}
