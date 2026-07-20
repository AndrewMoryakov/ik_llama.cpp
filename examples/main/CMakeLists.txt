set(TARGET llama-cli)
add_executable(${TARGET} main.cpp moe-trace.cpp moe-trace.h)
install(TARGETS ${TARGET} RUNTIME)
target_link_libraries(${TARGET} PRIVATE common llama ${CMAKE_THREAD_LIBS_INIT})
target_compile_features(${TARGET} PRIVATE cxx_std_11)

if (LLAMA_BUILD_TESTS)
    add_test(
        NAME test-moe-trace-cli-lifecycle
        COMMAND ${CMAKE_COMMAND}
            -DCLI=$<TARGET_FILE:${TARGET}>
            -DWORK=${CMAKE_CURRENT_BINARY_DIR}/moe-trace-cli-test
            -P ${PROJECT_SOURCE_DIR}/tests/test-moe-trace-cli.cmake)
    set_property(TEST test-moe-trace-cli-lifecycle PROPERTY LABELS main)
endif()
