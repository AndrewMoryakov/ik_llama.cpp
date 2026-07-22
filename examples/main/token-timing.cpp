#include "token-timing.h"

#include "ggml.h"

#include <algorithm>
#include <chrono>
#include <cctype>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <filesystem>
#include <iomanip>
#include <limits>
#include <locale>
#include <sstream>
#include <system_error>
#include <utility>

#ifdef _WIN32
#  define WIN32_LEAN_AND_MEAN
#  include <windows.h>
#else
#  include <cerrno>
#  include <fcntl.h>
#  include <unistd.h>
#endif

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
    std::string lhs = normalized_path(left).string();
    std::string rhs = normalized_path(right).string();
#ifdef _WIN32
    lhs = lowercase(std::move(lhs));
    rhs = lowercase(std::move(rhs));
#endif
    return lhs == rhs;
}

std::vector<fs::path> model_shards(const fs::path & model, std::error_code & error) {
    std::vector<fs::path> result;
    error.clear();
    fs::directory_iterator it(model.parent_path(), error);
    const fs::directory_iterator end;
    while (!error && it != end) {
        if (lowercase(it->path().extension().string()) == ".gguf") {
            result.push_back(it->path());
        }
        it.increment(error);
    }
    if (std::none_of(result.begin(), result.end(), [&](const fs::path & candidate) {
            return paths_alias(candidate, model);
        })) {
        result.push_back(model);
    }
    return result;
}

std::string json_escape(const std::string & value) {
    std::ostringstream out;
    for (unsigned char ch : value) {
        switch (ch) {
            case '"': out << "\\\""; break;
            case '\\': out << "\\\\"; break;
            case '\b': out << "\\b"; break;
            case '\f': out << "\\f"; break;
            case '\n': out << "\\n"; break;
            case '\r': out << "\\r"; break;
            case '\t': out << "\\t"; break;
            default:
                if (ch < 0x20) {
                    out << "\\u" << std::hex << std::setw(4) << std::setfill('0') << (int) ch << std::dec;
                } else {
                    out << static_cast<char>(ch);
                }
        }
    }
    return out.str();
}

bool write_exclusive(
        const fs::path & path, const std::string & data, bool & created_by_us, std::string & error) {
    created_by_us = false;
#ifdef _WIN32
    HANDLE handle = CreateFileW(path.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_NEW,
                                FILE_ATTRIBUTE_NORMAL | FILE_FLAG_WRITE_THROUGH, nullptr);
    if (handle == INVALID_HANDLE_VALUE) {
        error = "cannot create temporary timing file (Windows error " + std::to_string(GetLastError()) + ")";
        return false;
    }
    created_by_us = true;
    size_t offset = 0;
    bool ok = true;
    while (offset < data.size()) {
        const DWORD amount = static_cast<DWORD>(std::min<size_t>(data.size() - offset, 1u << 30));
        DWORD written = 0;
        if (!WriteFile(handle, data.data() + offset, amount, &written, nullptr) || written == 0) {
            error = "cannot write temporary timing file (Windows error " + std::to_string(GetLastError()) + ")";
            ok = false;
            break;
        }
        offset += written;
    }
    if (ok && !FlushFileBuffers(handle)) {
        error = "cannot flush temporary timing file (Windows error " + std::to_string(GetLastError()) + ")";
        ok = false;
    }
    if (!CloseHandle(handle) && ok) {
        error = "cannot close temporary timing file (Windows error " + std::to_string(GetLastError()) + ")";
        ok = false;
    }
    return ok;
#else
    const int fd = ::open(path.c_str(), O_WRONLY | O_CREAT | O_EXCL, 0666);
    if (fd < 0) {
        error = std::string("cannot create temporary timing file: ") + std::strerror(errno);
        return false;
    }
    created_by_us = true;
    size_t offset = 0;
    bool ok = true;
    while (offset < data.size()) {
        const ssize_t written = ::write(fd, data.data() + offset, data.size() - offset);
        if (written <= 0) {
            error = std::string("cannot write temporary timing file: ") + std::strerror(errno);
            ok = false;
            break;
        }
        offset += static_cast<size_t>(written);
    }
    if (ok && ::fsync(fd) != 0) {
        error = std::string("cannot flush temporary timing file: ") + std::strerror(errno);
        ok = false;
    }
    if (::close(fd) != 0 && ok) {
        error = std::string("cannot close temporary timing file: ") + std::strerror(errno);
        ok = false;
    }
    return ok;
#endif
}

bool publish_no_replace(const fs::path & temp, const fs::path & final, std::string & error) {
#ifdef _WIN32
    if (MoveFileExW(temp.c_str(), final.c_str(), MOVEFILE_WRITE_THROUGH)) {
        return true;
    }
    error = "cannot publish timing file without replacing an existing path (Windows error " +
            std::to_string(GetLastError()) + ")";
    return false;
#else
    if (::link(temp.c_str(), final.c_str()) == 0) {
        if (::unlink(temp.c_str()) == 0) {
            return true;
        }
        // The final hard link is already a complete, durable file. Report the
        // cleanup problem but do not pretend publication failed.
        return true;
    }
    error = std::string("cannot publish timing file without replacing an existing path: ") + std::strerror(errno);
    return false;
#endif
}

} // namespace

token_timing_writer::~token_timing_writer() = default;

bool token_timing_writer::start(
        const std::string & path,
        const std::string & model_path,
        const std::vector<std::string> & protected_paths) {
    if (started_) {
        fail("token timing writer is already started");
        return false;
    }
    if (path.empty()) {
        fail("token timing output path must not be empty");
        return false;
    }
    const fs::path output(path);
    std::error_code error;
    if (fs::exists(output, error) || error) {
        fail(error ? "cannot inspect token timing output path" : "token timing output already exists");
        return false;
    }
    const fs::path canonical_model = fs::canonical(model_path, error);
    if (error) {
        fail("cannot resolve model path for token timing identity: " + model_path);
        return false;
    }
    const std::vector<fs::path> shards = model_shards(canonical_model, error);
    if (error) {
        fail("cannot enumerate model directory before token timing");
        return false;
    }
    for (const fs::path & shard : shards) {
        if (paths_alias(output, shard)) {
            fail("token timing output aliases a model shard");
            return false;
        }
    }
    for (const std::string & protected_path : protected_paths) {
        if (!protected_path.empty() && paths_alias(output, protected_path)) {
            fail("token timing output aliases a CLI input");
            return false;
        }
    }
    const fs::path parent = output.has_parent_path() ? output.parent_path() : fs::current_path(error);
    if (error || !fs::is_directory(parent, error) || error) {
        fail("token timing output directory does not exist");
        return false;
    }

    path_ = output.string();
    model_path_ = canonical_model.string();
    anchor_monotonic_us_ = ggml_time_us();
    anchor_utc_unix_us_ = std::chrono::duration_cast<std::chrono::microseconds>(
        std::chrono::system_clock::now().time_since_epoch()).count();
    started_ = true;
    return true;
}

bool token_timing_writer::after_sample(
        llama_token output_token,
        bool output_is_eog,
        int64_t ready_monotonic_us,
        const llama_timings & cumulative) {
    if (!started_ || finished_ || !error_.empty()) {
        fail("cannot record token timing in the current writer state");
        return false;
    }
    if (!std::isfinite(cumulative.t_eval_ms) || !std::isfinite(cumulative.t_sample_ms)) {
        fail("non-finite cumulative timing value");
        return false;
    }
    if (generated_tokens_ == 0) {
        if (ready_monotonic_us < anchor_monotonic_us_) {
            fail("sample timestamp predates the token timing anchor");
            return false;
        }
        previous_ready_us_ = ready_monotonic_us;
        previous_eval_ms_ = cumulative.t_eval_ms;
        previous_sample_ms_ = cumulative.t_sample_ms;
        previous_output_token_ = output_token;
        last_reported_n_eval_ = cumulative.n_eval;
        generated_tokens_ = 1;
        return true;
    }
    const double eval_delta_ms = cumulative.t_eval_ms - previous_eval_ms_;
    const double sample_delta_ms = cumulative.t_sample_ms - previous_sample_ms_;
    if (ready_monotonic_us <= previous_ready_us_ || eval_delta_ms < 0.0 || sample_delta_ms < 0.0) {
        fail("non-monotonic token timing values");
        return false;
    }
    if (cumulative.n_eval != static_cast<int32_t>(generated_tokens_)) {
        fail("llama n_eval does not match the token timing interval");
        return false;
    }
    interval item;
    item.index = intervals_.size();
    item.input_token = previous_output_token_;
    item.output_token = output_token;
    item.output_is_eog = output_is_eog;
    item.ready_offset_us = ready_monotonic_us - anchor_monotonic_us_;
    item.inter_ready_us = ready_monotonic_us - previous_ready_us_;
    item.eval_us = static_cast<int64_t>(std::llround(eval_delta_ms * 1000.0));
    item.sample_us = static_cast<int64_t>(std::llround(sample_delta_ms * 1000.0));
    intervals_.push_back(item);
    previous_ready_us_ = ready_monotonic_us;
    previous_eval_ms_ = cumulative.t_eval_ms;
    previous_sample_ms_ = cumulative.t_sample_ms;
    previous_output_token_ = output_token;
    last_reported_n_eval_ = cumulative.n_eval;
    ++generated_tokens_;
    return true;
}

bool token_timing_writer::finish(const llama_timings & final_cumulative) {
    if (finished_) {
        return error_.empty();
    }
    if (!started_ || !error_.empty()) {
        fail("cannot finish token timing writer");
        return false;
    }
    if (generated_tokens_ == 0 || intervals_.size() + 1 != generated_tokens_) {
        fail("token timing stream has no sampled token or inconsistent counts");
        return false;
    }
    // llama_get_timings() clamps n_eval to one, so a one-token generation has
    // reported n_eval=1 even though no generated token was decoded. For G>1
    // the public counter must exactly match the G-1 interval contract.
    if (generated_tokens_ > 1 &&
        (final_cumulative.n_eval != static_cast<int32_t>(intervals_.size()) ||
         last_reported_n_eval_ != final_cumulative.n_eval)) {
        fail("final llama n_eval does not match token timing interval count");
        return false;
    }

    std::ostringstream out;
    out.imbue(std::locale::classic());
    out << "{\"type\":\"header\",\"version\":1,\"clock\":\"monotonic_us\","
        << "\"anchor_monotonic_us\":" << anchor_monotonic_us_
        << ",\"anchor_utc_unix_us\":" << anchor_utc_unix_us_
        << ",\"model_path\":\"" << json_escape(model_path_) << "\"}\n";
    for (const interval & item : intervals_) {
        out << "{\"type\":\"interval\",\"index\":" << item.index
            << ",\"input_token_id\":" << item.input_token
            << ",\"output_token_id\":" << item.output_token
            << ",\"output_is_eog\":" << (item.output_is_eog ? "true" : "false")
            << ",\"ready_offset_us\":" << item.ready_offset_us
            << ",\"inter_ready_us\":" << item.inter_ready_us
            << ",\"eval_us\":" << item.eval_us
            << ",\"sample_us\":" << item.sample_us << "}\n";
    }
    out << "{\"type\":\"end\",\"complete\":true,\"generated_tokens\":" << generated_tokens_
        << ",\"intervals\":" << intervals_.size() << ",\"n_eval\":" << intervals_.size()
        << ",\"llama_reported_n_eval\":" << final_cumulative.n_eval << "}\n";

    const fs::path final(path_);
    fs::path temp;
    std::string io_error;
    bool wrote = false;
    for (unsigned attempt = 0; attempt < 32 && !wrote; ++attempt) {
        temp = final;
        temp += ".tmp." + std::to_string(anchor_monotonic_us_) + "." + std::to_string(attempt);
        io_error.clear();
        bool created_by_us = false;
        wrote = write_exclusive(temp, out.str(), created_by_us, io_error);
        if (!wrote && created_by_us) {
            std::error_code remove_error;
            fs::remove(temp, remove_error);
        }
    }
    if (!wrote) {
        fail(io_error.empty() ? "cannot create a unique temporary timing file" : io_error);
        return false;
    }
    if (!publish_no_replace(temp, final, io_error)) {
        std::error_code remove_error;
        fs::remove(temp, remove_error);
        fail(io_error);
        return false;
    }
    finished_ = true;
    return true;
}

bool token_timing_writer::good() const { return error_.empty(); }
std::string token_timing_writer::error() const { return error_; }
uint64_t token_timing_writer::generated_tokens() const { return generated_tokens_; }
uint64_t token_timing_writer::interval_count() const { return intervals_.size(); }

void token_timing_writer::fail(const std::string & message) {
    if (error_.empty()) {
        error_ = message;
    }
}
