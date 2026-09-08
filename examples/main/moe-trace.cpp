#include "moe-trace.h"

#include "ggml.h"

#include <algorithm>
#include <cerrno>
#include <cctype>
#include <cmath>
#include <cstdlib>
#include <cstring>
#include <exception>
#include <filesystem>
#include <iomanip>
#include <iostream>
#include <limits>
#include <locale>
#include <sstream>
#include <utility>

namespace {

namespace fs = std::filesystem;

std::string lowercase(std::string value) {
    std::transform(value.begin(), value.end(), value.begin(), [](unsigned char ch) {
        return static_cast<char>(std::tolower(ch));
    });
    return value;
}

fs::path normalized_path(const fs::path & path) {
    std::error_code error;
    fs::path result = fs::weakly_canonical(path, error);
    if (error) {
        error.clear();
        result = fs::absolute(path, error);
    }
    return error ? path.lexically_normal() : result.lexically_normal();
}

bool paths_alias(const fs::path & left, const fs::path & right) {
    std::error_code left_error;
    std::error_code right_error;
    const bool left_exists = fs::exists(left, left_error);
    const bool right_exists = fs::exists(right, right_error);
    if (!left_error && !right_error && left_exists && right_exists) {
        std::error_code equivalent_error;
        if (fs::equivalent(left, right, equivalent_error) && !equivalent_error) {
            return true;
        }
    }

    std::string left_name = normalized_path(left).string();
    std::string right_name = normalized_path(right).string();
#ifdef _WIN32
    left_name = lowercase(std::move(left_name));
    right_name = lowercase(std::move(right_name));
#endif
    return left_name == right_name;
}

std::vector<fs::path> model_shard_paths(const fs::path & canonical_model, std::error_code & error) {
    // llama.cpp canonical split shards live beside the entry file. Scan every
    // GGUF sibling rather than relying only on filename parsing: this also
    // protects noncanonical/case-varied shard names and hard-link aliases.
    std::vector<fs::path> result;
    error.clear();
    fs::directory_iterator iterator(canonical_model.parent_path(), error);
    const fs::directory_iterator end;
    while (!error && iterator != end) {
        const fs::path candidate = iterator->path();
        if (lowercase(candidate.extension().string()) == ".gguf") {
            result.push_back(candidate);
        }
        iterator.increment(error);
    }
    if (std::none_of(result.begin(), result.end(), [&](const fs::path & candidate) {
            return paths_alias(candidate, canonical_model);
        })) {
        result.push_back(canonical_model);
    }
    return result;
}

template <typename T>
bool read_tensor(const ggml_tensor * tensor, std::vector<T> & values) {
    if (tensor == nullptr || ggml_nbytes(tensor) % sizeof(T) != 0) {
        return false;
    }
    values.resize(ggml_nbytes(tensor) / sizeof(T));
    if (!values.empty()) {
        ggml_backend_tensor_get(tensor, values.data(), 0, ggml_nbytes(tensor));
    }
    return true;
}

void fnv1a64_update(uint64_t & value, const std::string & text) {
    for (unsigned char byte : text) {
        value ^= byte;
        value *= UINT64_C(0x100000001b3);
    }
}

std::string model_architecture(llama_model * model) {
    char value[64] = {};
    const int32_t length = llama_model_meta_val_str(model, "general.architecture", value, sizeof(value));
    return length > 0 && length < static_cast<int32_t>(sizeof(value)) ? std::string(value) : std::string();
}

std::string expert_model_signature(
        llama_model * model, bool & valid, std::vector<int32_t> & moe_layers) {
    uint64_t value = UINT64_C(0xcbf29ce484222325);
    valid = true;
    moe_layers.clear();
    const int32_t n_layer = llama_n_layer(model);
    for (int32_t layer = 0; layer < n_layer; ++layer) {
        const std::string prefix = "blk." + std::to_string(layer) + ".ffn_";
        const std::string down_name = prefix + "down_exps.weight";
        ggml_tensor * gate_up = llama_get_model_tensor(model, (prefix + "gate_up_exps.weight").c_str());

        std::vector<std::pair<std::string, ggml_tensor *>> tensors;
        ggml_tensor * gate = llama_get_model_tensor(model, (prefix + "gate_exps.weight").c_str());
        ggml_tensor * up = llama_get_model_tensor(model, (prefix + "up_exps.weight").c_str());
        ggml_tensor * down = llama_get_model_tensor(model, down_name.c_str());
        if (gate_up != nullptr) {
            valid = valid && down != nullptr && gate == nullptr && up == nullptr;
            tensors.push_back({ "gate_up", gate_up });
            tensors.push_back({ "down", down });
            moe_layers.push_back(layer);
        } else if (gate != nullptr || up != nullptr || down != nullptr) {
            valid = valid && gate != nullptr && up != nullptr && down != nullptr;
            tensors.push_back({ "gate", gate });
            tensors.push_back({ "up", up });
            tensors.push_back({ "down", down });
            moe_layers.push_back(layer);
        } else {
            continue;
        }
        for (const auto & item : tensors) {
            const ggml_tensor * tensor = item.second;
            if (tensor == nullptr) {
                valid = false;
                continue;
            }
            std::ostringstream row;
            row << layer << '|' << item.first << '|' << tensor->name << '|'
                << static_cast<int>(tensor->type) << '|'
                << tensor->ne[0] << ',' << tensor->ne[1] << ',' << tensor->ne[2] << '|'
                << ggml_nbytes(tensor) << '\n';
            fnv1a64_update(value, row.str());
        }
    }
    std::ostringstream result;
    result << std::hex << std::setw(16) << std::setfill('0') << value;
    valid = valid && !moe_layers.empty();
    return result.str();
}

} // namespace

bool moe_trace_writer::start(
        struct llama_model * model,
        const std::string & path,
        const std::string & model_path,
        const std::vector<std::string> & protected_paths) {
    if (model == nullptr) {
        std::lock_guard<std::mutex> lock(mutex_);
        fail("cannot initialize trace for a null model");
        return false;
    }
    bool signature_valid = false;
    model_info info;
    info.n_layer = llama_n_layer(model);
    info.architecture = model_architecture(model);
    info.signature = expert_model_signature(model, signature_valid, info.moe_layers);
    if (!signature_valid) {
        std::lock_guard<std::mutex> lock(mutex_);
        fail("model has incomplete or unsupported merged expert tensors");
        return false;
    }
    return start(info, path, model_path, protected_paths);
}

bool moe_trace_writer::start(
        const model_info & info,
        const std::string & path,
        const std::string & model_path,
        const std::vector<std::string> & protected_paths) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (!error_.empty()) {
        return false;
    }
    if (opened_) {
        fail("trace output is already open");
        return false;
    }
    std::unordered_set<int32_t> validated_layers;
    if (!validate_model_info(info, validated_layers)) {
        return false;
    }
    return open_and_write_header(info, path, model_path, protected_paths);
}

bool moe_trace_writer::open_and_write_header(
        const model_info & info,
        const std::string & path,
        const std::string & model_path,
        const std::vector<std::string> & protected_paths) {
    if (path.empty()) {
        fail("trace output path must not be empty");
        return false;
    }
    const fs::path output_path(path);
    const fs::path input_path(model_path);
    std::error_code canonical_error;
    const fs::path canonical_model = fs::canonical(input_path, canonical_error);
    if (canonical_error) {
        fail("cannot resolve model path for trace identity: " + model_path);
        return false;
    }

    if (lowercase(output_path.extension().string()) == ".gguf") {
        fail("trace output must not use the .gguf model-file extension");
        return false;
    }
    std::error_code shard_scan_error;
    const std::vector<fs::path> shard_paths = model_shard_paths(canonical_model, shard_scan_error);
    if (shard_scan_error) {
        fail("cannot enumerate model directory before opening trace output: " +
             canonical_model.parent_path().string());
        return false;
    }
    for (const fs::path & shard : shard_paths) {
        if (paths_alias(output_path, shard)) {
            fail("trace output must not overwrite a model shard: " + shard.string());
            return false;
        }
        const fs::path sidecar(shard.string() + ".json");
        if (paths_alias(output_path, sidecar)) {
            fail("trace output must not overwrite a model download sidecar: " + sidecar.string());
            return false;
        }
    }
    for (const std::string & protected_path : protected_paths) {
        if (!protected_path.empty() && paths_alias(output_path, fs::path(protected_path))) {
            fail("trace output must not overwrite another CLI input/output: " + protected_path);
            return false;
        }
    }

    std::error_code size_error;
    const uintmax_t model_size = fs::file_size(canonical_model, size_error);
    if (size_error || model_size == 0) {
        fail("cannot determine model file size for trace identity: " + canonical_model.string());
        return false;
    }
    out_.open(path.c_str(), std::ios::out | std::ios::trunc);
    if (!out_) {
        fail("cannot open trace file: " + path);
        return false;
    }
    out_.imbue(std::locale::classic());
    opened_ = true;
    out_ << "{\"type\":\"meta\",\"schema\":\"ik_llama.moe_routing_trace\","
         << "\"version\":1,\"model\":\"" << json_escape(canonical_model.string()) << "\","
         << "\"model_file_size\":" << model_size << ','
         << "\"scope\":\"single_token_target_decode\","
         << "\"selection_score\":\"router_probability_with_selection_bias_if_present\","
         << "\"weight\":\"normalized_pre_scale_moe_contribution\","
         << "\"measurement_overhead\":true}\n";
    out_ << "{\"type\":\"model\",\"n_layer\":" << info.n_layer
         << ",\"architecture\":\"" << json_escape(info.architecture) << "\""
         << ",\"moe_layers\":" << info.moe_layers.size()
         << ",\"moe_layer_ids\":[";
    for (size_t index = 0; index < info.moe_layers.size(); ++index) {
        if (index > 0) {
            out_ << ',';
        }
        out_ << info.moe_layers[index];
    }
    out_ << ']'
         << ",\"model_signature_scheme\":\"fnv1a64-expert-layout-v1\""
         << ",\"model_signature\":\"" << json_escape(info.signature) << "\"}\n";
    out_.flush();
    if (!out_) {
        fail("failed while writing MoE trace header/model records");
        return false;
    }
    expected_moe_layers_.insert(info.moe_layers.begin(), info.moe_layers.end());
    model_info_written_ = true;
    return true;
}

moe_trace_writer::~moe_trace_writer() {
    std::lock_guard<std::mutex> lock(mutex_);
    if (opened_ && !finished_) {
        flush_all();
    }
    if (out_) {
        out_.flush();
    }
}

bool moe_trace_writer::good() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return error_.empty() && (!opened_ || out_.good());
}

std::string moe_trace_writer::error() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return error_;
}

bool moe_trace_writer::validate_model_info(
        const model_info & info, std::unordered_set<int32_t> & layers) {
    if (info.architecture != "qwen3moe" && info.architecture != "minimax-m2") {
        fail("unsupported MoE routing architecture for trace v1: " + info.architecture);
        return false;
    }
    if (info.n_layer <= 0 || info.moe_layers.empty() || info.signature.empty()) {
        fail("invalid or incomplete model metadata for trace v1");
        return false;
    }
    int32_t previous_layer = -1;
    for (int32_t layer : info.moe_layers) {
        if (layer < 0 || layer >= info.n_layer || !layers.insert(layer).second) {
            fail("invalid or duplicate MoE layer in model metadata");
            return false;
        }
        if (layer <= previous_layer) {
            fail("MoE layer IDs must be in strictly increasing order");
            return false;
        }
        previous_layer = layer;
    }
    return true;
}

bool moe_trace_writer::finish() {
    std::lock_guard<std::mutex> lock(mutex_);
    if (finished_) {
        return error_.empty() && out_.good();
    }
    if (in_batch_) {
        fail("cannot finish while a decode batch is active");
        return false;
    }
    if (!opened_ || !model_info_written_) {
        fail("cannot finish before trace output and model metadata are initialized");
        return false;
    }
    flush_all();
    if (!error_.empty() || !out_) {
        return false;
    }
    if (completed_batches_ == 0 || event_index_ == 0) {
        fail("no target-decode MoE routes were collected");
        return false;
    }
    out_ << "{\"type\":\"end\",\"complete\":true,\"batches\":" << completed_batches_
         << ",\"routes\":" << event_index_ << "}\n";
    out_.flush();
    if (!out_) {
        fail("failed while writing MoE trace footer");
        return false;
    }
    finished_ = true;
    return true;
}

void moe_trace_writer::begin_batch(
        const llama_token * tokens, int32_t n_tokens, llama_pos pos, llama_seq_id sequence) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (in_batch_) {
        fail("begin_batch called before end_batch");
        return;
    }
    if (finished_) {
        fail("begin_batch called after finish");
        return;
    }
    if (!opened_ || !model_info_written_) {
        fail("begin_batch called before trace initialization completed");
        return;
    }
    flush_all();
    in_batch_ = true;
    if (tokens == nullptr || n_tokens != 1) {
        fail("MoE trace v1 requires exactly one target-decode token per batch");
        return;
    }
    trace_batch_ = true;
    ++batch_index_;
    current_batch_layers_.clear();
    input_token_ = tokens[0];
    input_pos_ = pos;
    sequence_ = sequence;
}

void moe_trace_writer::end_batch() {
    std::lock_guard<std::mutex> lock(mutex_);
    if (!in_batch_) {
        fail("end_batch called without begin_batch");
        return;
    }
    const bool was_trace_batch = trace_batch_;
    flush_all();
    if (was_trace_batch && error_.empty()) {
        if (current_batch_layers_ != expected_moe_layers_) {
            std::vector<int32_t> missing;
            for (int32_t layer : expected_moe_layers_) {
                if (current_batch_layers_.count(layer) == 0) {
                    missing.push_back(layer);
                }
            }
            std::sort(missing.begin(), missing.end());
            std::ostringstream message;
            message << "incomplete MoE layer set in target batch " << batch_index_
                    << ": captured " << current_batch_layers_.size()
                    << " of " << expected_moe_layers_.size();
            if (!missing.empty()) {
                message << ", first missing layer " << missing.front();
            }
            fail(message.str());
        } else {
            ++completed_batches_;
        }
    }
    trace_batch_ = false;
    in_batch_ = false;
    if (out_) {
        out_.flush();
        lines_since_flush_ = 0;
        if (!out_) {
            fail("failed while flushing MoE trace batch");
        }
    }
}

int moe_trace_writer::callback(struct ggml_tensor * tensor, bool ask, void * user_data) {
    auto * self = static_cast<moe_trace_writer *>(user_data);
    if (self == nullptr || tensor == nullptr) {
        return false;
    }
    if (ask) {
        std::lock_guard<std::mutex> lock(self->mutex_);
        return !self->finished_ && self->trace_batch_ && self->error_.empty() && self->wants(tensor->name);
    }
    try {
        std::lock_guard<std::mutex> lock(self->mutex_);
        if (!self->finished_ && self->trace_batch_ && self->error_.empty()) {
            self->collect(tensor);
        }
    } catch (const std::exception & exc) {
        std::lock_guard<std::mutex> lock(self->mutex_);
        self->fail(std::string("trace callback failed: ") + exc.what());
    } catch (...) {
        std::lock_guard<std::mutex> lock(self->mutex_);
        self->fail("trace callback failed with an unknown error");
    }
    return true;
}

bool moe_trace_writer::wants(const char * name) const {
    int32_t layer = -1;
    return parse_layer(name, "ffn_moe_probs-", layer) ||
           parse_layer(name, "ffn_moe_probs_biased-", layer) ||
           parse_layer(name, "ffn_moe_topk-", layer) ||
           parse_layer(name, "ffn_moe_weights_norm-", layer);
}

void moe_trace_writer::collect(struct ggml_tensor * tensor) {
    int32_t layer = -1;
    if (parse_layer(tensor->name, "ffn_moe_probs-", layer) ||
        parse_layer(tensor->name, "ffn_moe_probs_biased-", layer)) {
        collect_selection(tensor, layer);
    } else if (parse_layer(tensor->name, "ffn_moe_topk-", layer)) {
        collect_topk(tensor, layer);
    } else if (parse_layer(tensor->name, "ffn_moe_weights_norm-", layer)) {
        collect_weights(tensor, layer);
    }
}

void moe_trace_writer::collect_selection(struct ggml_tensor * tensor, int32_t layer) {
    if (tensor->type != GGML_TYPE_F32 || tensor->ne[1] != 1 || tensor->ne[0] <= 0) {
        fail("unexpected MoE selection tensor at layer " + std::to_string(layer));
        return;
    }
    pending_route & route = pending_[layer];
    route.layer = layer;
    route.n_expert = static_cast<int32_t>(tensor->ne[0]);
    if (!read_tensor(tensor, route.selection) || route.selection.size() != static_cast<size_t>(route.n_expert)) {
        fail("cannot read MoE selection scores at layer " + std::to_string(layer));
    }
}

void moe_trace_writer::collect_topk(struct ggml_tensor * tensor, int32_t layer) {
    auto it = pending_.find(layer);
    if (it == pending_.end() || it->second.selection.empty()) {
        fail("MoE top-k observed before selection scores at layer " + std::to_string(layer));
        return;
    }
    if (tensor->type != GGML_TYPE_I32 || tensor->ne[1] != 1 || tensor->ne[0] <= 0) {
        fail("unexpected MoE top-k tensor at layer " + std::to_string(layer));
        return;
    }
    pending_route & route = it->second;
    route.n_expert_used = static_cast<int32_t>(tensor->ne[0]);
    if (!read_tensor(tensor, route.ids) || route.ids.size() != static_cast<size_t>(route.n_expert_used)) {
        fail("cannot read MoE top-k IDs at layer " + std::to_string(layer));
        return;
    }
    route.selection_scores.resize(route.ids.size());
    for (size_t rank = 0; rank < route.ids.size(); ++rank) {
        const int32_t expert = route.ids[rank];
        if (expert < 0 || expert >= route.n_expert) {
            fail("invalid expert ID at layer " + std::to_string(layer));
            return;
        }
        route.selection_scores[rank] = route.selection[expert];
    }
}

void moe_trace_writer::collect_weights(struct ggml_tensor * tensor, int32_t layer) {
    auto it = pending_.find(layer);
    if (it == pending_.end() || it->second.ids.empty()) {
        fail("MoE weights observed before top-k at layer " + std::to_string(layer));
        return;
    }
    if (tensor->type != GGML_TYPE_F32) {
        fail("unexpected MoE contribution-weight type at layer " + std::to_string(layer));
        return;
    }
    if (!read_tensor(tensor, it->second.weights) || it->second.weights.size() != it->second.ids.size()) {
        fail("cannot read MoE contribution weights at layer " + std::to_string(layer));
    }
}

void moe_trace_writer::flush_pending(int32_t layer) {
    if (!error_.empty()) {
        return;
    }
    auto it = pending_.find(layer);
    if (it == pending_.end()) {
        return;
    }
    const pending_route & route = it->second;
    if (route.selection.empty() || route.ids.empty() || route.weights.size() != route.ids.size()) {
        fail("incomplete MoE route at layer " + std::to_string(layer) +
             " (v1 requires normalized MoE weights)");
        pending_.erase(it);
        return;
    }
    if (route.n_expert_used <= 0 || route.ids.size() != static_cast<size_t>(route.n_expert_used) ||
        route.selection_scores.size() != route.ids.size()) {
        fail("inconsistent MoE route dimensions at layer " + std::to_string(layer));
        pending_.erase(it);
        return;
    }
    if (expected_moe_layers_.count(layer) == 0) {
        fail("unexpected MoE route at layer " + std::to_string(layer));
        pending_.erase(it);
        return;
    }
    std::unordered_set<int32_t> unique_experts;
    double weight_sum = 0.0;
    for (int32_t rank = 0; rank < route.n_expert_used; ++rank) {
        const float score = route.selection_scores[rank];
        const float weight = route.weights[rank];
        if (!std::isfinite(score) || !std::isfinite(weight) || weight < 0.0f) {
            fail("non-finite MoE score or non-finite/negative weight at layer " + std::to_string(layer));
            pending_.erase(it);
            return;
        }
        if (!unique_experts.insert(route.ids[rank]).second) {
            fail("duplicate selected expert at layer " + std::to_string(layer));
            pending_.erase(it);
            return;
        }
        weight_sum += weight;
    }
    if (!std::isfinite(weight_sum) || std::fabs(weight_sum - 1.0) > 1e-3) {
        fail("normalized MoE weights do not sum to one at layer " + std::to_string(layer));
        pending_.erase(it);
        return;
    }
    if (!current_batch_layers_.insert(layer).second) {
        fail("duplicate MoE route at layer " + std::to_string(layer));
        pending_.erase(it);
        return;
    }

    out_ << std::setprecision(9)
         << "{\"type\":\"route\",\"event\":" << event_index_
         << ",\"sequence\":" << sequence_
         << ",\"batch_index\":" << batch_index_
         << ",\"pos\":" << input_pos_
         << ",\"input_token_id\":" << input_token_
         << ",\"layer\":" << route.layer
         << ",\"n_expert\":" << route.n_expert
         << ",\"selected\":[";
    for (int32_t rank = 0; rank < route.n_expert_used; ++rank) {
        if (rank > 0) {
            out_ << ',';
        }
        out_ << "{\"rank\":" << rank
             << ",\"expert\":" << route.ids[rank]
             << ",\"selection_score\":" << route.selection_scores[rank]
             << ",\"weight\":" << route.weights[rank] << '}';
    }
    out_ << "]}\n";
    if (++lines_since_flush_ >= 256) {
        out_.flush();
        lines_since_flush_ = 0;
    }
    if (!out_) {
        fail("failed while writing MoE trace");
    } else {
        ++event_index_;
    }
    pending_.erase(it);
}

void moe_trace_writer::flush_all() {
    if (!error_.empty()) {
        return;
    }
    std::vector<int32_t> layers;
    layers.reserve(pending_.size());
    for (const auto & item : pending_) {
        layers.push_back(item.first);
    }
    std::sort(layers.begin(), layers.end());
    for (int32_t layer : layers) {
        flush_pending(layer);
        if (!error_.empty()) {
            break;
        }
    }
}

void moe_trace_writer::fail(const std::string & message) {
    if (error_.empty()) {
        error_ = message;
        std::cerr << "moe trace: " << message << std::endl;
    }
}

bool moe_trace_writer::parse_layer(const char * name, const char * prefix, int32_t & layer) {
    if (name == nullptr || prefix == nullptr) {
        return false;
    }
    const size_t prefix_len = std::strlen(prefix);
    if (std::strncmp(name, prefix, prefix_len) != 0 || name[prefix_len] == '\0') {
        return false;
    }
    char * end = nullptr;
    errno = 0;
    const long value = std::strtol(name + prefix_len, &end, 10);
    if (errno != 0 || end == name + prefix_len || *end != '\0' || value < 0 ||
        value > std::numeric_limits<int32_t>::max()) {
        return false;
    }
    layer = static_cast<int32_t>(value);
    return true;
}

std::string moe_trace_writer::json_escape(const std::string & value) {
    std::ostringstream escaped;
    for (unsigned char ch : value) {
        switch (ch) {
            case '\\': escaped << "\\\\"; break;
            case '"':  escaped << "\\\""; break;
            case '\b': escaped << "\\b"; break;
            case '\f': escaped << "\\f"; break;
            case '\n': escaped << "\\n"; break;
            case '\r': escaped << "\\r"; break;
            case '\t': escaped << "\\t"; break;
            default:
                if (ch < 0x20) {
                    escaped << "\\u" << std::hex << std::setw(4) << std::setfill('0')
                            << static_cast<int>(ch) << std::dec << std::setfill(' ');
                } else {
                    escaped << static_cast<char>(ch);
                }
        }
    }
    return escaped.str();
}
