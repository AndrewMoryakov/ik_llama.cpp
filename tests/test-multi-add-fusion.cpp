#include "ggml-cuda/fusion-utils.h"

int main() {
    auto * ctx = ggml_init({65536, nullptr, true});
    auto * input = ggml_new_tensor_2d(ctx, GGML_TYPE_F32, 16, 8);
    auto * sum = ggml_multi_add(ctx, input, 4);
    auto * scaled = ggml_scale(ctx, sum, 0.5f);
    auto * graph = ggml_new_graph_custom(ctx, 16, false);
    ggml_build_forward_expand(graph, scaled);
    const int index = graph->n_nodes - 2;
    bool ok = ggml_cuda_can_fuse_multi_add_scale(graph, index);
    ok &= !ggml_cuda_can_fuse_multi_add_scale(graph, index + 1);
    ggml_set_output(sum);
    ok &= !ggml_cuda_can_fuse_multi_add_scale(graph, index);
    sum->flags &= ~GGML_TENSOR_FLAG_OUTPUT;
    auto * other = ggml_add(ctx, sum, sum);
    ggml_build_forward_expand(graph, other);
    ok &= !ggml_cuda_can_fuse_multi_add_scale(graph, index);
    ggml_free(ctx);
    return ok ? 0 : 1;
}
