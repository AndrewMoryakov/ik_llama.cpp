#pragma once

#include "ggml.h"

static inline bool ggml_cuda_can_fuse_multi_add_scale(const ggml_cgraph * graph, int index) {
    if (index < 0 || index + 1 >= graph->n_nodes) return false;
    const auto * sum = graph->nodes[index];
    const auto * scale = graph->nodes[index + 1];
    if (sum->op != GGML_OP_MULTI_ADD || scale->op != GGML_OP_SCALE ||
            scale->src[0] != sum || (sum->flags & GGML_TENSOR_FLAG_OUTPUT) ||
            !ggml_are_same_shape(sum, scale)) return false;
    for (int i = index + 2; i < graph->n_nodes; ++i) {
        const auto * node = graph->nodes[i];
        if (node->view_src == sum) return false;
        for (auto * source : node->src) {
            if (source == sum) return false;
        }
    }
    return true;
}
