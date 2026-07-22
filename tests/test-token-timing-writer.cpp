#include "token-timing.h"
#include "ggml.h"

#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <chrono>
#include <filesystem>
#include <fstream>
#include <sstream>
#include <string>

namespace fs = std::filesystem;

static llama_timings timings(double eval_ms, double sample_ms, int32_t n_eval = 1) {
    llama_timings result = {};
    result.t_eval_ms = eval_ms;
    result.t_sample_ms = sample_ms;
    result.n_eval = n_eval;
    return result;
}

static std::string read_all(const fs::path & path) {
    std::ifstream input(path, std::ios::binary);
    std::ostringstream contents;
    contents << input.rdbuf();
    return contents.str();
}

int main() {
    ggml_time_init();
    const auto nonce = std::chrono::high_resolution_clock::now().time_since_epoch().count();
    const fs::path root = fs::temp_directory_path() / ("ik-token-timing-" + std::to_string(nonce));
    assert(fs::create_directories(root));
    const fs::path model = root / "model-00001-of-00002.gguf";
    const fs::path shard = root / "model-00002-of-00002.gguf";
    std::ofstream(model) << "model";
    std::ofstream(shard) << "shard";

    {
        const fs::path output = root / "one.ndjson";
        token_timing_writer writer;
        assert(writer.start(output.string(), model.string()));
        const int64_t base = ggml_time_us();
        assert(writer.after_sample(10, false, base, timings(5.0, 1.0)));
        assert(writer.generated_tokens() == 1);
        assert(writer.interval_count() == 0);
        assert(writer.finish(timings(5.0, 1.0, 1)));
        const std::string text = read_all(output);
        assert(text.find("\"complete\":true") != std::string::npos);
        assert(text.find("\"generated_tokens\":1") != std::string::npos);
        assert(text.find("\"intervals\":0") != std::string::npos);
    }
    {
        const fs::path output = root / "three.ndjson";
        token_timing_writer writer;
        assert(writer.start(output.string(), model.string()));
        const int64_t base = ggml_time_us();
        assert(writer.after_sample(10, false, base, timings(5.0, 1.0)));
        assert(writer.after_sample(20, false, base + 1500, timings(6.25, 1.2, 1)));
        assert(writer.after_sample(30, true, base + 4000, timings(8.5, 1.5, 2)));
        assert(writer.finish(timings(8.5, 1.5, 2)));
        const std::string text = read_all(output);
        assert(text.find("\"input_token_id\":10,\"output_token_id\":20") != std::string::npos);
        assert(text.find("\"inter_ready_us\":1500,\"eval_us\":1250,\"sample_us\":200") != std::string::npos);
        assert(text.find("\"output_token_id\":30,\"output_is_eog\":true") != std::string::npos);
        assert(text.find("\"generated_tokens\":3,\"intervals\":2,\"n_eval\":2") != std::string::npos);
    }
    {
        token_timing_writer writer;
        assert(!writer.start(shard.string(), model.string()));
        assert(!writer.good());
    }
    {
        const fs::path protected_input = root / "prompt.txt";
        std::ofstream(protected_input) << "prompt";
        token_timing_writer writer;
        assert(!writer.start(protected_input.string(), model.string(), { protected_input.string() }));
    }
    {
        const fs::path output = root / "existing.ndjson";
        std::ofstream(output) << "sentinel";
        token_timing_writer writer;
        assert(!writer.start(output.string(), model.string()));
        assert(read_all(output) == "sentinel");
    }
    {
        const fs::path output = root / "empty.ndjson";
        token_timing_writer writer;
        assert(writer.start(output.string(), model.string()));
        assert(!writer.finish(timings(0.0, 0.0, 1)));
        assert(!fs::exists(output));
    }
    {
        token_timing_writer writer;
        assert(writer.start((root / "bad-values.ndjson").string(), model.string()));
        const int64_t base = ggml_time_us();
        assert(writer.after_sample(1, false, base, timings(1.0, 1.0)));
        assert(!writer.after_sample(2, false, base - 1, timings(2.0, 2.0)));
        assert(!writer.finish(timings(2.0, 2.0, 1)));
    }
    {
        const fs::path output = root / "publish-race.ndjson";
        token_timing_writer writer;
        assert(writer.start(output.string(), model.string()));
        assert(writer.after_sample(1, false, ggml_time_us(), timings(1.0, 1.0, 1)));
        std::ofstream(output) << "racer";
        assert(!writer.finish(timings(1.0, 1.0, 1)));
        assert(read_all(output) == "racer");
        size_t temporary_count = 0;
        for (const auto & entry : fs::directory_iterator(root)) {
            if (entry.path().filename().string().find("publish-race.ndjson.tmp.") == 0) {
                ++temporary_count;
            }
        }
        assert(temporary_count == 0);
    }
    {
        const fs::path vanished = root / "vanished";
        assert(fs::create_directory(vanished));
        const fs::path output = vanished / "write-failure.ndjson";
        token_timing_writer writer;
        assert(writer.start(output.string(), model.string()));
        assert(writer.after_sample(1, false, ggml_time_us(), timings(1.0, 1.0, 1)));
        assert(fs::remove(vanished));
        assert(!writer.finish(timings(1.0, 1.0, 1)));
        assert(!fs::exists(output));
    }
    {
        token_timing_writer writer;
        assert(writer.start((root / "eval-mismatch.ndjson").string(), model.string()));
        const int64_t base = ggml_time_us();
        assert(writer.after_sample(1, false, base, timings(1.0, 1.0, 1)));
        assert(!writer.after_sample(2, false, base + 100, timings(2.0, 2.0, 2)));
    }

    std::error_code error;
    fs::remove_all(root, error);
    return 0;
}
