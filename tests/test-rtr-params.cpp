#include "common.h"
#include "llama.h"

#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <chrono>
#include <filesystem>
#include <fstream>
#include <initializer_list>
#include <stdexcept>
#include <string>
#include <vector>

static gpt_params parse(std::initializer_list<const char *> args) {
    std::vector<std::string> storage;
    storage.reserve(args.size() + 1);
    storage.emplace_back("test-rtr-params");
    for (const char * arg : args) {
        storage.emplace_back(arg);
    }

    std::vector<char *> argv;
    argv.reserve(storage.size());
    for (std::string & arg : storage) {
        argv.push_back(&arg[0]);
    }

    gpt_params params;
    const bool ok = gpt_params_parse_ex((int) argv.size(), argv.data(), params);
    assert(ok);
    return params;
}

static bool parse_moe_trace(
        std::initializer_list<const char *> args, bool supported, gpt_params & params) {
    std::vector<std::string> storage = { "test-rtr-params" };
    for (const char * arg : args) {
        storage.emplace_back(arg);
    }
    std::vector<char *> argv;
    for (std::string & arg : storage) {
        argv.push_back(&arg[0]);
    }
    params.supports_moe_trace = supported;
    try {
        return gpt_params_parse_ex((int) argv.size(), argv.data(), params);
    } catch (const std::invalid_argument &) {
        return false;
    }
}

int main() {
    {
        gpt_params params;
        assert(!parse_moe_trace({ "--moe-trace", "trace.ndjson" }, false, params));
    }
    {
        gpt_params params;
        params.warmup = true;
        assert(parse_moe_trace(
            { "--moe-trace", "first.ndjson", "--moe-trace", "second.ndjson" }, true, params));
        assert(params.moe_trace_file == "second.ndjson");
        assert(params.warmup);
    }
    {
        gpt_params params;
        assert(!parse_moe_trace({ "--moe-trace" }, true, params));
    }
    {
        gpt_params params;
        assert(!parse_moe_trace({ "--moe-trace", "" }, true, params));
    }
    {
        namespace fs = std::filesystem;
        const auto nonce = std::chrono::high_resolution_clock::now().time_since_epoch().count();
        const fs::path root = fs::temp_directory_path() / ("ik-moe-parser-" + std::to_string(nonce));
        assert(fs::create_directories(root));
        const fs::path first = root / "first.txt";
        const fs::path second = root / "second.txt";
        std::ofstream(first) << "first";
        std::ofstream(second) << "second";
        const std::string first_name = first.string();
        const std::string second_name = second.string();
        gpt_params params;
        assert(parse_moe_trace(
            { "-f", first_name.c_str(), "-f", second_name.c_str(),
              "--moe-trace", first_name.c_str() }, true, params));
        assert(params.protected_input_paths.size() >= 2);
        assert(params.protected_input_paths[0] == first_name);
        assert(params.protected_input_paths[1] == second_name);
        std::error_code error;
        fs::remove_all(root, error);
    }
    {
        const gpt_params params = parse({ "-rtr", "1", "-rtr", "auto" });
        assert(params.repack_tensors);
        assert(params.repack_tensors_auto);
        assert(params.use_mmap);
    }
    {
        const gpt_params params = parse({ "-rtr", "1", "-rtr", "0" });
        assert(!params.repack_tensors);
        assert(!params.repack_tensors_auto);
        assert(params.use_mmap);
    }
    {
        const gpt_params params = parse({ "--no-mmap", "-rtr", "auto" });
        assert(params.repack_tensors);
        assert(params.repack_tensors_auto);
        assert(!params.use_mmap);
    }
    {
        const gpt_params params = parse({ "-rtr", "auto", "-rtr", "on" });
        assert(params.repack_tensors);
        assert(!params.repack_tensors_auto);
        // The loader, not the parser, applies the legacy forced-repack coupling.
        assert(params.use_mmap);
    }
    {
        const gpt_params params = parse({ "-rtr" });
        assert(params.repack_tensors);
        assert(!params.repack_tensors_auto);
        assert(params.use_mmap);
    }
    {
        const gpt_params params = parse({ "-rtra" });
        assert(params.repack_tensors);
        assert(params.repack_tensors_auto);
        assert(params.use_mmap);
    }

    assert(!llama_model_loader_mmap_enabled(nullptr));
    assert(!llama_model_mmap_requested(nullptr));
    assert(!llama_model_has_mmap_buffers(nullptr));
    assert(!llama_model_repack_pass_executed(nullptr));
    assert(llama_model_n_repacked(nullptr) == 0);

    return 0;
}
