#include "ggml.h"
#include "ggml-alloc.h"
#include "ggml-backend.h"

#include <climits>
#include <cstdio>

// Exercise the actual scheduler with host weights and no offload device. Invalid
// one-based hints must fall back to the CPU without indexing outside backends.
static bool check_hint(int32_t hint) {
    ggml_backend_t cpu = ggml_backend_cpu_init();
    ggml_init_params params = {1024 * 1024, nullptr, true};
    ggml_context * weights_ctx = ggml_init(params);
    ggml_context * graph_ctx = ggml_init(params);
    ggml_tensor * weights = ggml_new_tensor_2d(weights_ctx, GGML_TYPE_F32, 2, 2);
    ggml_backend_buffer_t buffer = ggml_backend_alloc_ctx_tensors(weights_ctx, cpu);
    ggml_backend_buffer_set_usage(buffer, GGML_BACKEND_BUFFER_USAGE_WEIGHTS);
    const float w[] = {1, 2, 3, 4};
    ggml_backend_tensor_set(weights, w, 0, sizeof(w));
    ggml_tensor * input = ggml_new_tensor_2d(graph_ctx, GGML_TYPE_F32, 2, 1);
    ggml_set_input(input);
    ggml_tensor * result = ggml_mul_mat(graph_ctx, weights, input);
    result->op_params[11] = hint;
    ggml_set_output(result);
    ggml_cgraph * graph = ggml_new_graph(graph_ctx);
    ggml_build_forward_expand(graph, result);
    ggml_backend_sched_t sched = ggml_backend_sched_new(&cpu, nullptr, 1, 32, false);
    ggml_backend_sched_set_op_offload(sched, GGML_OP_MUL_MAT, true);
    bool ok = ggml_backend_sched_alloc_graph(sched, graph);
    if (ok) {
        const float x[] = {5, 6};
        ggml_backend_tensor_set(input, x, 0, sizeof(x));
        ok = ggml_backend_sched_graph_compute(sched, graph) == GGML_STATUS_SUCCESS;
        if (ok) {
            float y[2];
            ggml_backend_tensor_get(result, y, 0, sizeof(y));
            ok = y[0] == 17 && y[1] == 39;
        }
    }
    ggml_backend_sched_free(sched);
    ggml_backend_buffer_free(buffer);
    ggml_free(graph_ctx);
    ggml_free(weights_ctx);
    ggml_backend_free(cpu);
    if (!ok) std::fprintf(stderr, "offload hint %d failed\n", hint);
    return ok;
}

int main() {
    const int32_t hints[] = {0, -1, INT_MIN, 1, INT_MAX};
    for (int32_t hint : hints) {
        if (!check_hint(hint)) return 1;
    }
    return 0;
}
