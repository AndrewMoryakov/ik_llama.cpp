#llama_add_compile_flags()

function(llama_build source)
    set(TEST_SOURCES ${source} ${ARGN})

    if (DEFINED LLAMA_TEST_NAME)
        set(TEST_TARGET ${LLAMA_TEST_NAME})
    else()
        get_filename_component(TEST_TARGET ${source} NAME_WE)
    endif()

    add_executable(${TEST_TARGET} ${TEST_SOURCES})
    target_link_libraries(${TEST_TARGET} PRIVATE common)
    install(TARGETS ${TEST_TARGET} RUNTIME)
endfunction()

function(llama_test target)
    include(CMakeParseArguments)
    set(options)
    set(oneValueArgs NAME LABEL WORKING_DIRECTORY)
    set(multiValueArgs ARGS)
    cmake_parse_arguments(LLAMA_TEST "${options}" "${oneValueArgs}" "${multiValueArgs}" ${ARGN})

    if (NOT DEFINED LLAMA_TEST_LABEL)
        set(LLAMA_TEST_LABEL "main")
    endif()
    if (NOT DEFINED LLAMA_TEST_WORKING_DIRECTORY)
        set(LLAMA_TEST_WORKING_DIRECTORY .)
    endif()
    if (DEFINED LLAMA_TEST_NAME)
        set(TEST_NAME ${LLAMA_TEST_NAME})
    else()
        set(TEST_NAME ${target})
    endif()

    set(TEST_TARGET ${target})

    add_test(
        NAME ${TEST_NAME}
        WORKING_DIRECTORY ${LLAMA_TEST_WORKING_DIRECTORY}
        COMMAND $<TARGET_FILE:${TEST_TARGET}>
        ${LLAMA_TEST_ARGS})

    set_property(TEST ${TEST_NAME} PROPERTY LABELS ${LLAMA_TEST_LABEL})
endfunction()

# Builds and runs a test source file.
# Optional args:
# - NAME: name of the executable & test target (defaults to the source file name without extension)
# - LABEL: label for the test (defaults to main)
# - ARGS: arguments to pass to the test executable
# - WORKING_DIRECTORY
function(llama_target_and_test source)
    include(CMakeParseArguments)
    set(options)
    set(oneValueArgs NAME LABEL WORKING_DIRECTORY)
    set(multiValueArgs ARGS)
    cmake_parse_arguments(LLAMA_TEST "${options}" "${oneValueArgs}" "${multiValueArgs}" ${ARGN})

    set(TEST_SOURCES ${source} ${LLAMA_TEST_UNPARSED_ARGUMENTS} get-model.cpp)

    if (NOT DEFINED LLAMA_TEST_LABEL)
        set(LLAMA_TEST_LABEL "main")
    endif()
    if (NOT DEFINED LLAMA_TEST_WORKING_DIRECTORY)
        set(LLAMA_TEST_WORKING_DIRECTORY .)
    endif()
    if (DEFINED LLAMA_TEST_NAME)
        set(TEST_TARGET ${LLAMA_TEST_NAME})
    else()
        get_filename_component(TEST_TARGET ${source} NAME_WE)
    endif()

    add_executable(${TEST_TARGET} ${TEST_SOURCES})
    install(TARGETS ${TEST_TARGET} RUNTIME)
    target_link_libraries(${TEST_TARGET} PRIVATE common)
    add_test(
        NAME ${TEST_TARGET}
        WORKING_DIRECTORY ${LLAMA_TEST_WORKING_DIRECTORY}
        COMMAND $<TARGET_FILE:${TEST_TARGET}>
        ${LLAMA_TEST_ARGS})

    set_property(TEST ${TEST_TARGET} PROPERTY LABELS ${LLAMA_TEST_LABEL})
endfunction()

function(llama_build_and_test source)
    include(CMakeParseArguments)
    set(options)
    set(oneValueArgs NAME LABEL WORKING_DIRECTORY)
    set(multiValueArgs ARGS)
    cmake_parse_arguments(LLAMA_TEST "${options}" "${oneValueArgs}" "${multiValueArgs}" ${ARGN})

    set(TEST_SOURCES ${source} ${LLAMA_TEST_UNPARSED_ARGUMENTS} get-model.cpp)

    if (NOT DEFINED LLAMA_TEST_LABEL)
        set(LLAMA_TEST_LABEL "main")
    endif()
    if (NOT DEFINED LLAMA_TEST_WORKING_DIRECTORY)
        set(LLAMA_TEST_WORKING_DIRECTORY .)
    endif()
    if (DEFINED LLAMA_TEST_NAME)
        set(TEST_TARGET ${LLAMA_TEST_NAME})
    else()
        get_filename_component(TEST_TARGET ${source} NAME_WE)
    endif()

    add_executable(${TEST_TARGET} ${TEST_SOURCES})
    if (LLAMA_TESTS_INSTALL)
        install(TARGETS ${TEST_TARGET} RUNTIME)
    endif()
    target_link_libraries(${TEST_TARGET} PRIVATE common)

    add_test(
        NAME ${TEST_TARGET}
        WORKING_DIRECTORY ${LLAMA_TEST_WORKING_DIRECTORY}
        COMMAND $<TARGET_FILE:${TEST_TARGET}>
        ${LLAMA_TEST_ARGS})

    set_property(TEST ${TEST_TARGET} PROPERTY LABELS ${LLAMA_TEST_LABEL})
endfunction()

llama_build(test-sampling-history.cpp)
llama_test(test-sampling-history)

llama_build(test-ngram-cache.cpp)
llama_test(test-ngram-cache)

llama_build(test-mamba2.cpp)
llama_test(test-mamba2)

# build test-tokenizer-0 target once and add many tests
add_executable(test-tokenizer-0 test-tokenizer-0.cpp)
target_link_libraries(test-tokenizer-0 PRIVATE common)
install(TARGETS test-tokenizer-0 RUNTIME)

llama_test(test-tokenizer-0 NAME test-tokenizer-0-bert-bge          ARGS ${CMAKE_CURRENT_SOURCE_DIR}/../models/ggml-vocab-bert-bge.gguf)
llama_test(test-tokenizer-0 NAME test-tokenizer-0-command-r         ARGS ${CMAKE_CURRENT_SOURCE_DIR}/../models/ggml-vocab-command-r.gguf)
llama_test(test-tokenizer-0 NAME test-tokenizer-0-deepseek-coder    ARGS ${CMAKE_CURRENT_SOURCE_DIR}/../models/ggml-vocab-deepseek-coder.gguf)
llama_test(test-tokenizer-0 NAME test-tokenizer-0-deepseek-llm      ARGS ${CMAKE_CURRENT_SOURCE_DIR}/../models/ggml-vocab-deepseek-llm.gguf)
llama_test(test-tokenizer-0 NAME test-tokenizer-0-falcon            ARGS ${CMAKE_CURRENT_SOURCE_DIR}/../models/ggml-vocab-falcon.gguf)
llama_test(test-tokenizer-0 NAME test-tokenizer-0-gpt-2             ARGS ${CMAKE_CURRENT_SOURCE_DIR}/../models/ggml-vocab-gpt-2.gguf)
llama_test(test-tokenizer-0 NAME test-tokenizer-0-llama-bpe         ARGS ${CMAKE_CURRENT_SOURCE_DIR}/../models/ggml-vocab-llama-bpe.gguf)
llama_test(test-tokenizer-0 NAME test-tokenizer-0-llama-spm         ARGS ${CMAKE_CURRENT_SOURCE_DIR}/../models/ggml-vocab-llama-spm.gguf)
llama_test(test-tokenizer-0 NAME test-tokenizer-0-mpt               ARGS ${CMAKE_CURRENT_SOURCE_DIR}/../models/ggml-vocab-mpt.gguf)
llama_test(test-tokenizer-0 NAME test-tokenizer-0-phi-3             ARGS ${CMAKE_CURRENT_SOURCE_DIR}/../models/ggml-vocab-phi-3.gguf)
llama_test(test-tokenizer-0 NAME test-tokenizer-0-qwen2             ARGS ${CMAKE_CURRENT_SOURCE_DIR}/../models/ggml-vocab-qwen2.gguf)
llama_test(test-tokenizer-0 NAME test-tokenizer-0-refact            ARGS ${CMAKE_CURRENT_SOURCE_DIR}/../models/ggml-vocab-refact.gguf)
llama_test(test-tokenizer-0 NAME test-tokenizer-0-starcoder         ARGS ${CMAKE_CURRENT_SOURCE_DIR}/../models/ggml-vocab-starcoder.gguf)

if (LLAMA_LLGUIDANCE)
    llama_target_and_test(test-grammar-llguidance.cpp ARGS ${CMAKE_CURRENT_SOURCE_DIR}/../models/ggml-vocab-llama-bpe.gguf)
endif ()

if (NOT WIN32)
    # these tests are disabled on Windows because they use internal functions not exported with LLAMA_API
    #llama_target_and_test(test-sampling.cpp)
    #llama_target_and_test(test-grammar-parser.cpp)
    #llama_target_and_test(test-grammar-integration.cpp)
    #llama_target_and_test(test-llama-grammar.cpp)
    #llama_target_and_test(test-chat.cpp)
    # TODO: disabled on loongarch64 because the ggml-ci node lacks Python 3.8
    #if (NOT ${CMAKE_SYSTEM_PROCESSOR} MATCHES "loongarch64")
    #    llama_target_and_test(test-json-schema-to-grammar.cpp   WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/..)
    #    target_include_directories(test-json-schema-to-grammar PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/../examples/server)
    #endif()


    # build test-tokenizer-1-bpe target once and add many tests
    # add_executable(test-tokenizer-1-bpe test-tokenizer-1-bpe.cpp)
    # target_link_libraries(test-tokenizer-1-bpe PRIVATE common)
    # install(TARGETS test-tokenizer-1-bpe RUNTIME)

    # TODO: disabled due to slowness
    #llama_test(test-tokenizer-1-bpe NAME test-tokenizer-1-aquila    ARGS ${CMAKE_CURRENT_SOURCE_DIR}/../models/ggml-vocab-aquila.gguf)
    #llama_test(test-tokenizer-1-bpe NAME test-tokenizer-1-falcon    ARGS ${CMAKE_CURRENT_SOURCE_DIR}/../models/ggml-vocab-falcon.gguf)
    #llama_test(test-tokenizer-1-bpe NAME test-tokenizer-1-gpt-2     ARGS ${CMAKE_CURRENT_SOURCE_DIR}/../models/ggml-vocab-gpt-2.gguf)
    #llama_test(test-tokenizer-1-bpe NAME test-tokenizer-1-gpt-neox  ARGS ${CMAKE_CURRENT_SOURCE_DIR}/../models/ggml-vocab-gpt-neox.gguf)
    #llama_test(test-tokenizer-1-bpe NAME test-tokenizer-1-llama-bpe ARGS ${CMAKE_CURRENT_SOURCE_DIR}/../models/ggml-vocab-llama-bpe.gguf --ignore-merges)
    #llama_test(test-tokenizer-1-bpe NAME test-tokenizer-1-mpt       ARGS ${CMAKE_CURRENT_SOURCE_DIR}/../models/ggml-vocab-mpt.gguf)
    #llama_test(test-tokenizer-1-bpe NAME test-tokenizer-1-refact    ARGS ${CMAKE_CURRENT_SOURCE_DIR}/../models/ggml-vocab-refact.gguf)
    #llama_test(test-tokenizer-1-bpe NAME test-tokenizer-1-starcoder ARGS ${CMAKE_CURRENT_SOURCE_DIR}/../models/ggml-vocab-starcoder.gguf)

    # build test-tokenizer-1-spm target once and add many tests
    # add_executable(test-tokenizer-1-spm test-tokenizer-1-spm.cpp)
    # target_link_libraries(test-tokenizer-1-spm PRIVATE common)
    # install(TARGETS test-tokenizer-1-spm RUNTIME)

    # llama_test(test-tokenizer-1-spm  NAME test-tokenizer-1-llama-spm ARGS ${CMAKE_CURRENT_SOURCE_DIR}/../models/ggml-vocab-llama-spm.gguf)
    #llama_test(test-tokenizer-1-spm  NAME test-tokenizer-1-baichuan  ARGS ${CMAKE_CURRENT_SOURCE_DIR}/../models/ggml-vocab-baichuan.gguf)

    # llama_target_and_test(test-double-float.cpp) # SLOW
endif()

#llama_build_and_test(test-chat-peg-parser.cpp peg-parser/simple-tokenize.cpp)
llama_build_and_test(test-jinja.cpp)
llama_test(test-jinja NAME test-jinja-py ARGS -py LABEL python)
llama_build_and_test(test-chat-auto-parser.cpp WORKING_DIRECTORY ${PROJECT_SOURCE_DIR})
llama_build_and_test(test-chat-template.cpp )
llama_test(test-chat-template
    NAME test-chat-template-hy3
    ARGS --no-common --stop-on-first-fail ${PROJECT_SOURCE_DIR}/models/templates/tencent-Hy3.jinja)
llama_build_and_test(test-json-partial.cpp )
llama_build_and_test(test-cpu-affinity.cpp )
llama_build_and_test(test-nanbeige-loop.cpp )
llama_build_and_test(test-sensenova-loop.cpp )

add_executable(test-inkling-ops test-inkling-ops.cpp)
target_link_libraries(test-inkling-ops PRIVATE ggml)
add_test(NAME test-inkling-ops COMMAND $<TARGET_FILE:test-inkling-ops>)

add_executable(test-inkling-bias-control test-inkling-bias-control.cpp)
target_link_libraries(test-inkling-bias-control PRIVATE ggml)
add_test(NAME test-inkling-bias-control COMMAND $<TARGET_FILE:test-inkling-bias-control>)

add_executable(test-cpu-intake-nov23 test-cpu-intake-nov23.cpp)
target_link_libraries(test-cpu-intake-nov23 PRIVATE ggml)
add_test(NAME test-cpu-intake-nov23 COMMAND $<TARGET_FILE:test-cpu-intake-nov23>)

# The loader is internal and is not DLL-exported on Windows.
if (NOT WIN32)
    add_executable(test-expert-scale-reload test-expert-scale-reload.cpp)
    target_include_directories(test-expert-scale-reload PRIVATE ${PROJECT_SOURCE_DIR}/src)
    target_link_libraries(test-expert-scale-reload PRIVATE llama)
    add_test(NAME test-expert-scale-reload COMMAND $<TARGET_FILE:test-expert-scale-reload>)
    add_executable(test-tied-embedding test-tied-embedding.cpp)
    target_include_directories(test-tied-embedding PRIVATE ${PROJECT_SOURCE_DIR}/src)
    target_link_libraries(test-tied-embedding PRIVATE llama)
    add_test(NAME test-tied-embedding COMMAND $<TARGET_FILE:test-tied-embedding>)
    set_tests_properties(test-tied-embedding PROPERTIES SKIP_RETURN_CODE 77 LABELS model)
endif()
#llama_build_and_test(test-log.cpp)
llama_build_and_test(
    test-peg-parser.cpp
    peg-parser/simple-tokenize.cpp
    peg-parser/test-basic.cpp
    peg-parser/test-gbnf-generation.cpp
    peg-parser/test-json-parser.cpp
    peg-parser/test-json-serialization.cpp
    peg-parser/test-python-dict-parser.cpp
    peg-parser/test-unicode.cpp
    peg-parser/tests.h
)
llama_build_and_test(test-regex-partial.cpp)
llama_build_and_test(test-rtr-params.cpp)
llama_build_and_test(test-cgroup-resolver.cpp)

add_executable(test-hc-pre-transpose test-hc-pre-transpose.cpp)
target_link_libraries(test-hc-pre-transpose PRIVATE ggml)
add_test(NAME test-hc-pre-transpose COMMAND $<TARGET_FILE:test-hc-pre-transpose>)

add_executable(test-indexer-topk test-indexer-topk.cpp)
target_link_libraries(test-indexer-topk PRIVATE ggml)
add_test(NAME test-indexer-topk COMMAND $<TARGET_FILE:test-indexer-topk>)

add_executable(test-nvfp4 test-nvfp4.cpp)
target_link_libraries(test-nvfp4 PRIVATE ggml)
add_test(NAME test-nvfp4 COMMAND $<TARGET_FILE:test-nvfp4>)

add_executable(test-cuda-simple-gemm test-cuda-simple-gemm.cpp)
target_link_libraries(test-cuda-simple-gemm PRIVATE ggml)
add_test(NAME test-cuda-simple-gemm COMMAND $<TARGET_FILE:test-cuda-simple-gemm>)

add_executable(test-fused-up-gate-work test-fused-up-gate-work.cpp)
target_link_libraries(test-fused-up-gate-work PRIVATE ggml)
add_test(NAME test-fused-up-gate-work COMMAND $<TARGET_FILE:test-fused-up-gate-work>)

add_executable(test-server-tool-output
    test-server-tool-output.cpp
    ../examples/server/server-chat.cpp)
target_include_directories(test-server-tool-output PRIVATE
    ../examples/server ../examples/mtmd ${PROJECT_SOURCE_DIR})
target_link_libraries(test-server-tool-output PRIVATE common)
add_test(NAME test-server-tool-output COMMAND $<TARGET_FILE:test-server-tool-output>)

add_executable(test-moe-trace-writer
    test-moe-trace-writer.cpp
    ../examples/main/moe-trace.cpp)
target_include_directories(test-moe-trace-writer PRIVATE ../examples/main)
target_link_libraries(test-moe-trace-writer PRIVATE common)
add_test(NAME test-moe-trace-writer COMMAND $<TARGET_FILE:test-moe-trace-writer>)
set_property(TEST test-moe-trace-writer PROPERTY LABELS main)

add_executable(test-token-timing-writer
    test-token-timing-writer.cpp
    ../examples/main/token-timing.cpp)
target_include_directories(test-token-timing-writer PRIVATE ../examples/main)
target_link_libraries(test-token-timing-writer PRIVATE common)
add_test(NAME test-token-timing-writer COMMAND $<TARGET_FILE:test-token-timing-writer>)
set_property(TEST test-token-timing-writer PROPERTY LABELS main)

find_package(Python3 3.9 COMPONENTS Interpreter QUIET)
if (Python3_Interpreter_FOUND)
    add_test(
        NAME test-fp8-import
        COMMAND ${Python3_EXECUTABLE} ${CMAKE_CURRENT_SOURCE_DIR}/test-fp8-import.py
                --cli $<TARGET_FILE:llama-cli>)
    set_tests_properties(test-fp8-import PROPERTIES SKIP_RETURN_CODE 77 LABELS "model;python")
    add_executable(test-moe-warmup test-moe-warmup.cpp)
    target_link_libraries(test-moe-warmup PRIVATE llama)
    add_test(
        NAME test-moe-warmup
        COMMAND ${Python3_EXECUTABLE} ${CMAKE_CURRENT_SOURCE_DIR}/test-moe-warmup.py
                $<TARGET_FILE:test-moe-warmup>)
    set_tests_properties(test-moe-warmup PROPERTIES LABELS "model;python")
    if (BUILD_SHARED_LIBS)
        add_test(
            NAME test-nvfp4-import
            COMMAND ${Python3_EXECUTABLE} ${CMAKE_CURRENT_SOURCE_DIR}/test-nvfp4-import.py
                    --cli $<TARGET_FILE:llama-cli> --quantize $<TARGET_FILE:llama-quantize>
                    --library $<TARGET_FILE:ggml>)
        set_tests_properties(test-nvfp4-import PROPERTIES SKIP_RETURN_CODE 77 LABELS "model;python")
    endif()
    add_test(
        NAME test-quantize-invariants
        COMMAND ${Python3_EXECUTABLE} ${CMAKE_CURRENT_SOURCE_DIR}/test-quantize-invariants.py
                --cli $<TARGET_FILE:llama-cli> --quantize $<TARGET_FILE:llama-quantize>)
    set_tests_properties(test-quantize-invariants PROPERTIES SKIP_RETURN_CODE 77 LABELS "model;python")
    add_test(
        NAME test-gpt2-layernorm
        COMMAND ${Python3_EXECUTABLE} ${CMAKE_CURRENT_SOURCE_DIR}/test-gpt2-layernorm.py
                --cli $<TARGET_FILE:llama-cli>)
    set_tests_properties(test-gpt2-layernorm PROPERTIES LABELS "model;python")
    add_test(
        NAME test-ngram-file
        COMMAND ${Python3_EXECUTABLE} ${CMAKE_CURRENT_SOURCE_DIR}/test-ngram-file.py
                --cli $<TARGET_FILE:llama-cli>)
    set_tests_properties(test-ngram-file PROPERTIES SKIP_RETURN_CODE 77 LABELS "model;python")
    add_test(
        NAME test-analytical-imatrix
        COMMAND ${Python3_EXECUTABLE} ${CMAKE_CURRENT_SOURCE_DIR}/test-analytical-imatrix.py
                --quantize $<TARGET_FILE:llama-quantize>)
    set_tests_properties(test-analytical-imatrix PROPERTIES SKIP_RETURN_CODE 77 LABELS "model;python")
    add_test(
        NAME test-moe-cache-sim
        WORKING_DIRECTORY ${PROJECT_SOURCE_DIR}
        COMMAND ${Python3_EXECUTABLE} ${CMAKE_CURRENT_SOURCE_DIR}/test-moe-cache-sim.py)
    set_property(TEST test-moe-cache-sim PROPERTY LABELS python)
endif()

llama_build_and_test(test-iq4-ks-kt-decode.cpp)
target_include_directories(test-iq4-ks-kt-decode PRIVATE ${PROJECT_SOURCE_DIR}/ggml/src)

llama_build_and_test(test-quant-scale.cpp)
target_include_directories(test-quant-scale PRIVATE ${PROJECT_SOURCE_DIR}/ggml/src)

# llama_target_and_test(test-opt.cpp) # SLOW

llama_target_and_test(test-model-load-cancel.cpp  LABEL "model")
llama_target_and_test(test-autorelease.cpp        LABEL "model")


# dummy executable - not installed
get_filename_component(TEST_TARGET test-c.c NAME_WE)
add_executable(${TEST_TARGET} test-c.c)
target_link_libraries(${TEST_TARGET} PRIVATE llama)

add_executable(test-moe-cache-shares test-moe-cache-shares.cpp)
target_link_libraries(test-moe-cache-shares PRIVATE llama)
target_include_directories(test-moe-cache-shares PRIVATE
    ${PROJECT_SOURCE_DIR}/src
    ${PROJECT_SOURCE_DIR}/include
    ${PROJECT_SOURCE_DIR}/ggml/include)
add_test(NAME test-moe-cache-shares COMMAND $<TARGET_FILE:test-moe-cache-shares>)

add_executable(test-offload-device-hint test-offload-device-hint.cpp)
target_link_libraries(test-offload-device-hint PRIVATE ggml)
add_test(NAME test-offload-device-hint COMMAND $<TARGET_FILE:test-offload-device-hint>)

add_executable(test-intake-nov21 test-intake-nov21.cpp)
target_link_libraries(test-intake-nov21 PRIVATE ggml)
add_test(NAME test-intake-nov21 COMMAND $<TARGET_FILE:test-intake-nov21>)

find_package(Threads REQUIRED)
add_executable(test-context-allocation test-context-allocation.cpp)
target_link_libraries(test-context-allocation PRIVATE ggml Threads::Threads)
add_test(NAME test-context-allocation COMMAND $<TARGET_FILE:test-context-allocation>)

add_executable(test-multi-add-fusion test-multi-add-fusion.cpp)
target_include_directories(test-multi-add-fusion PRIVATE ${PROJECT_SOURCE_DIR}/ggml/src)
target_link_libraries(test-multi-add-fusion PRIVATE ggml)
add_test(NAME test-multi-add-fusion COMMAND $<TARGET_FILE:test-multi-add-fusion>)

add_executable(test-fp8-matmul test-fp8-matmul.cpp)
target_link_libraries(test-fp8-matmul PRIVATE ggml)
add_test(NAME test-fp8-matmul COMMAND $<TARGET_FILE:test-fp8-matmul>)

llama_target_and_test(test-kq-mask-fill.cpp LABEL "model")
target_include_directories(test-kq-mask-fill PRIVATE
    ${PROJECT_SOURCE_DIR}/src ${PROJECT_SOURCE_DIR}/ggml/src)

add_executable(test-conv-delta test-conv-delta.cpp)
target_link_libraries(test-conv-delta PRIVATE ggml)
add_test(NAME test-conv-delta COMMAND $<TARGET_FILE:test-conv-delta>)
if (NOT WIN32)
    add_executable(test-kv-holes test-kv-holes.cpp)
    target_include_directories(test-kv-holes PRIVATE ${PROJECT_SOURCE_DIR}/src)
    target_link_libraries(test-kv-holes PRIVATE llama)
    add_test(NAME test-kv-holes COMMAND $<TARGET_FILE:test-kv-holes>)
    set_tests_properties(test-kv-holes PROPERTIES SKIP_RETURN_CODE 77 LABELS model)
endif()
add_executable(test-inplace-backend test-inplace-backend.cpp)
target_link_libraries(test-inplace-backend PRIVATE ggml)
add_test(NAME test-inplace-backend COMMAND $<TARGET_FILE:test-inplace-backend>)
