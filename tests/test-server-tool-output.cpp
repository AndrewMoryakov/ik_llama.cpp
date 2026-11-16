#include "server-chat.h"

#include <cstdlib>
#include <cstdio>
#include <stdexcept>
#include <string_view>

// The conversion test links no HTTP server or media processor.
void server_log(const char *, const char *, int, const char *, const json &) {}

const char * get_media_marker() {
    std::abort();
}

static json convert(const json & output) {
    return server_chat_convert_responses_to_chatcmpl({
        {"input", json::array({
            {{"type", "function_call_output"}, {"call_id", "call_1"}, {"output", output}},
        })},
    }).at("messages").at(0);
}

static bool rejects(const json & part, std::string_view message) {
    try {
        convert(json::array({part}));
    } catch (const std::runtime_error & e) {
        return std::string_view(e.what()).find(message) != std::string_view::npos;
    }
    return false;
}

int main() {
    const char * image_url = "data:image/png;base64,AA==";
    const auto message = convert(json::array({
        {{"type", "input_text"}, {"text", "Tool result"}},
        {{"type", "input_image"}, {"image_url", image_url}},
    }));
    const auto & content = message.at("content");
    if (message.at("role") != "tool" || message.at("tool_call_id") != "call_1" ||
            !content.is_array() || content.size() != 2 ||
            content[0].at("type") != "text" || content[0].at("text") != "Tool result" ||
            content[1].at("type") != "image_url" || content[1].at("image_url").at("url") != image_url ||
            convert("plain").at("content") != "plain" ||
            !rejects({{"type", "input_image"}}, "'image_url' is required") ||
            !rejects({{"type", "input_audio"}}, "Output of tool call")) {
        std::fprintf(stderr, "Responses API tool output conversion did not match the expected shape\n");
        return 1;
    }
    return 0;
}
