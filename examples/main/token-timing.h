#pragma once

#include "llama.h"

#include <cstdint>
#include <string>
#include <vector>

// Diagnostic timing for the ordinary, single-sequence llama-cli decode path.
// No backend callback is installed. Records stay in memory until finish().
class token_timing_writer {
public:
    token_timing_writer() = default;
    ~token_timing_writer();

    token_timing_writer(const token_timing_writer &) = delete;
    token_timing_writer & operator=(const token_timing_writer &) = delete;

    bool start(
        const std::string & path,
        const std::string & model_path,
        const std::vector<std::string> & protected_paths = {});
    bool after_sample(
        llama_token output_token,
        bool output_is_eog,
        int64_t ready_monotonic_us,
        const llama_timings & cumulative);
    bool finish(const llama_timings & final_cumulative);

    bool good() const;
    std::string error() const;
    uint64_t generated_tokens() const;
    uint64_t interval_count() const;

private:
    struct interval {
        uint64_t index = 0;
        llama_token input_token = 0;
        llama_token output_token = 0;
        bool output_is_eog = false;
        int64_t ready_offset_us = 0;
        int64_t inter_ready_us = 0;
        int64_t eval_us = 0;
        int64_t sample_us = 0;
    };

    void fail(const std::string & message);

    std::string path_;
    std::string model_path_;
    std::string error_;
    std::vector<interval> intervals_;
    int64_t anchor_monotonic_us_ = 0;
    int64_t anchor_utc_unix_us_ = 0;
    int64_t previous_ready_us_ = 0;
    double previous_eval_ms_ = 0.0;
    double previous_sample_ms_ = 0.0;
    int32_t last_reported_n_eval_ = 0;
    llama_token previous_output_token_ = 0;
    uint64_t generated_tokens_ = 0;
    bool started_ = false;
    bool finished_ = false;
};
