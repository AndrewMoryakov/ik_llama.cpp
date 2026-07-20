#include "moe-trace.h"

#include "ggml.h"

#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <chrono>
#include <cmath>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <limits>
#include <sstream>
#include <string>

namespace fs = std::filesystem;

static std::string read_all(const fs::path & path) {
    std::ifstream input(path, std::ios::binary);
    return std::string(std::istreambuf_iterator<char>(input), std::istreambuf_iterator<char>());
}

static moe_trace_writer::model_info fake_info() {
    moe_trace_writer::model_info info;
    info.n_layer = 1;
    info.architecture = "qwen3moe";
    info.moe_layers = { 0 };
    info.signature = "0123456789abcdef";
    return info;
}

static void emit_route(
        moe_trace_writer & writer, float first_weight = 0.75f, float first_score = 0.75f) {
    ggml_init_params params = { 4096, nullptr, true };
    ggml_context * ctx = ggml_init(params);
    assert(ctx != nullptr);

    ggml_tensor * selection = ggml_new_tensor_1d(ctx, GGML_TYPE_F32, 3);
    ggml_tensor * topk = ggml_new_tensor_1d(ctx, GGML_TYPE_I32, 2);
    ggml_tensor * weights = ggml_new_tensor_1d(ctx, GGML_TYPE_F32, 2);
    ggml_set_name(selection, "ffn_moe_probs-0");
    ggml_set_name(topk, "ffn_moe_topk-0");
    ggml_set_name(weights, "ffn_moe_weights_norm-0");

    const float selection_values[] = { first_score, 0.25f, 0.0f };
    const int32_t ids[] = { 0, 1 };
    const float weight_values[] = { first_weight, 1.0f - first_weight };
    ggml_backend_t backend = ggml_backend_cpu_init();
    assert(backend != nullptr);
    ggml_backend_buffer_t buffer = ggml_backend_alloc_ctx_tensors(ctx, backend);
    assert(buffer != nullptr);
    ggml_backend_tensor_set(selection, selection_values, 0, sizeof(selection_values));
    ggml_backend_tensor_set(topk, ids, 0, sizeof(ids));
    ggml_backend_tensor_set(weights, weight_values, 0, sizeof(weight_values));

    for (ggml_tensor * tensor : { selection, topk, weights }) {
        assert(moe_trace_writer::callback(tensor, true, &writer));
        assert(moe_trace_writer::callback(tensor, false, &writer));
    }

    ggml_backend_buffer_free(buffer);
    ggml_backend_free(backend);
    ggml_free(ctx);
}

int main() {
    const auto nonce = std::chrono::high_resolution_clock::now().time_since_epoch().count();
    const fs::path root = fs::temp_directory_path() /
        ("ik-llama-moe-trace-test-" + std::to_string(nonce));
    std::error_code error;
    assert(fs::create_directories(root));
    const fs::path model = root / "model.bin";
    {
        std::ofstream stream(model, std::ios::binary);
        stream << "synthetic model identity";
    }

    // Dormant writers never create or truncate their eventual output.
    {
        const fs::path output = root / "dormant.ndjson";
        moe_trace_writer writer;
        assert(writer.good());
        assert(!fs::exists(output));
    }

    // Unsupported model metadata is rejected before an existing output is truncated.
    {
        const fs::path output = root / "unsupported.ndjson";
        {
            std::ofstream stream(output, std::ios::binary);
            stream << "existing output";
        }
        moe_trace_writer::model_info info = fake_info();
        info.architecture = "dense";
        moe_trace_writer writer;
        assert(!writer.start(info, output.string(), model.string()));
        assert(read_all(output) == "existing output");
    }

    // A complete single-layer batch produces a valid footer and exact counts.
    {
        const fs::path output = root / "complete.ndjson";
        moe_trace_writer writer;
        assert(writer.start(fake_info(), output.string(), model.string()));
        const llama_token token = 42;
        writer.begin_batch(&token, 1, 7, 0);
        emit_route(writer);
        writer.end_batch();
        assert(writer.finish());
        assert(writer.finish());
        const std::string text = read_all(output);
        assert(text.find("\"moe_layer_ids\":[0]") != std::string::npos);
        assert(text.find("\"complete\":true,\"batches\":1,\"routes\":1") != std::string::npos);
    }

    // MiniMax selection bias may make a valid selected score negative.
    {
        const fs::path output = root / "negative-score.ndjson";
        moe_trace_writer writer;
        assert(writer.start(fake_info(), output.string(), model.string()));
        const llama_token token = 43;
        writer.begin_batch(&token, 1, 8, 0);
        emit_route(writer, 0.75f, -0.25f);
        writer.end_batch();
        assert(writer.finish());
        assert(read_all(output).find("\"selection_score\":-0.25") != std::string::npos);
    }

    // Missing callbacks make the batch incomplete and must never certify it.
    {
        const fs::path output = root / "incomplete.ndjson";
        moe_trace_writer writer;
        assert(writer.start(fake_info(), output.string(), model.string()));
        const llama_token token = 1;
        writer.begin_batch(&token, 1, 0, 0);
        writer.end_batch();
        assert(!writer.finish());
        assert(read_all(output).find("\"complete\":true") == std::string::npos);
    }

    // Existing hard-link aliases are rejected before truncation.
    {
        const fs::path protected_file = root / "prompt.txt";
        const fs::path output = root / "prompt-alias.ndjson";
        {
            std::ofstream stream(protected_file, std::ios::binary);
            stream << "do not truncate";
        }
        fs::create_hard_link(protected_file, output, error);
        if (!error) {
            moe_trace_writer writer;
            assert(!writer.start(fake_info(), output.string(), model.string(), { protected_file.string() }));
            assert(read_all(protected_file) == "do not truncate");
        }
        error.clear();
    }

    // Non-finite selected data is rejected instead of emitting invalid JSON.
    {
        const fs::path output = root / "nonfinite.ndjson";
        moe_trace_writer writer;
        assert(writer.start(fake_info(), output.string(), model.string()));
        const llama_token token = 2;
        writer.begin_batch(&token, 1, 0, 0);
        emit_route(writer, std::numeric_limits<float>::infinity());
        writer.end_batch();
        assert(!writer.finish());
        assert(read_all(output).find("\"complete\":true") == std::string::npos);
    }

    fs::remove_all(root, error);
    return 0;
}
