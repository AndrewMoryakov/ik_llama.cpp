#pragma once

#include "ggml-backend.h"
#include "llama.h"

#include <cstdint>
#include <fstream>
#include <mutex>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

// Experimental measurement-only MoE routing trace for llama-cli.
// v1 intentionally records only single-token target decode batches. The eval
// callback synchronizes selected nodes, so trace-mode timings are not benchmarks.
class moe_trace_writer {
public:
    struct model_info {
        int32_t n_layer = 0;
        std::string architecture;
        std::vector<int32_t> moe_layers;
        std::string signature;
    };

    moe_trace_writer() = default;
    ~moe_trace_writer();

    moe_trace_writer(const moe_trace_writer &) = delete;
    moe_trace_writer & operator=(const moe_trace_writer &) = delete;

    bool start(
        struct llama_model * model,
        const std::string & path,
        const std::string & model_path,
        const std::vector<std::string> & protected_paths = {});
    bool start(
        const model_info & info,
        const std::string & path,
        const std::string & model_path,
        const std::vector<std::string> & protected_paths = {});
    bool good() const;
    std::string error() const;
    bool finish();

    void begin_batch(const llama_token * tokens, int32_t n_tokens, llama_pos pos, llama_seq_id sequence);
    void end_batch();

    static int callback(struct ggml_tensor * tensor, bool ask, void * user_data);

private:
    struct pending_route {
        int32_t layer = -1;
        int32_t n_expert = 0;
        int32_t n_expert_used = 0;
        std::vector<float> selection;
        std::vector<int32_t> ids;
        std::vector<float> selection_scores;
        std::vector<float> weights;
    };

    bool wants(const char * name) const;
    void collect(struct ggml_tensor * tensor);
    void collect_selection(struct ggml_tensor * tensor, int32_t layer);
    void collect_topk(struct ggml_tensor * tensor, int32_t layer);
    void collect_weights(struct ggml_tensor * tensor, int32_t layer);
    void flush_pending(int32_t layer);
    void flush_all();
    void fail(const std::string & message);
    bool validate_model_info(const model_info & info, std::unordered_set<int32_t> & layers);
    bool open_and_write_header(
        const model_info & info,
        const std::string & path,
        const std::string & model_path,
        const std::vector<std::string> & protected_paths);

    static bool parse_layer(const char * name, const char * prefix, int32_t & layer);
    static std::string json_escape(const std::string & value);

    std::ofstream out_;
    std::string error_;
    mutable std::mutex mutex_;
    std::unordered_map<int32_t, pending_route> pending_;

    bool in_batch_ = false;
    bool trace_batch_ = false;
    int64_t batch_index_ = -1;
    llama_token input_token_ = 0;
    llama_pos input_pos_ = 0;
    llama_seq_id sequence_ = 0;
    uint64_t event_index_ = 0;
    uint64_t lines_since_flush_ = 0;
    uint64_t completed_batches_ = 0;
    std::unordered_set<int32_t> expected_moe_layers_;
    std::unordered_set<int32_t> current_batch_layers_;
    bool opened_ = false;
    bool model_info_written_ = false;
    bool finished_ = false;
};
