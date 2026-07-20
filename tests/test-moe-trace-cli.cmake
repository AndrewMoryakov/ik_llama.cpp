if (NOT DEFINED CLI OR NOT DEFINED WORK)
    message(FATAL_ERROR "CLI and WORK are required")
endif()

file(REMOVE_RECURSE "${WORK}")
file(MAKE_DIRECTORY "${WORK}")

# A failed/first-download model initialization must leave no partial trace.
set(trace "${WORK}/failed-load.ndjson")
execute_process(
    COMMAND "${CLI}" -m "${WORK}/missing-model.gguf" --moe-trace "${trace}" -n 1
    RESULT_VARIABLE result
    OUTPUT_QUIET ERROR_QUIET)
if (result EQUAL 0 OR EXISTS "${trace}")
    message(FATAL_ERROR "failed model load created a trace or returned success")
endif()

# Empty output is a parser error, not a request to silently disable tracing.
execute_process(
    COMMAND "${CLI}" --moe-trace ""
    RESULT_VARIABLE result
    OUTPUT_QUIET ERROR_VARIABLE empty_error)
if (result EQUAL 0 OR NOT empty_error MATCHES "moe-trace path must not be empty")
    message(FATAL_ERROR "empty --moe-trace path was not rejected by the parser")
endif()

# Early-return modes are rejected before a writer can truncate its destination.
foreach(mode IN ITEMS --embedding --logits-all)
    string(REPLACE "--" "" stem "${mode}")
    set(sentinel "${WORK}/${stem}.sentinel")
    file(WRITE "${sentinel}" "DO-NOT-TRUNCATE")
    execute_process(
        COMMAND "${CLI}" "${mode}" --moe-trace "${sentinel}"
        RESULT_VARIABLE result
        OUTPUT_QUIET ERROR_QUIET)
    file(READ "${sentinel}" content)
    if (result EQUAL 0 OR NOT content STREQUAL "DO-NOT-TRUNCATE")
        message(FATAL_ERROR "${mode} trace rejection did not preserve its destination")
    endif()
endforeach()

file(REMOVE_RECURSE "${WORK}")
