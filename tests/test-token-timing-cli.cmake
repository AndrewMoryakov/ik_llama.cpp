if(NOT DEFINED CLI OR NOT DEFINED WORK)
    message(FATAL_ERROR "CLI and WORK are required")
endif()

file(REMOVE_RECURSE "${WORK}")
file(MAKE_DIRECTORY "${WORK}")

execute_process(
    COMMAND "${CLI}" --token-timing
    RESULT_VARIABLE missing_result
    OUTPUT_QUIET
    ERROR_VARIABLE missing_error)
if(missing_result EQUAL 0 OR NOT missing_error MATCHES "invalid parameter for argument: --token-timing")
    message(FATAL_ERROR "missing --token-timing value was not rejected: ${missing_error}")
endif()

execute_process(
    COMMAND "${CLI}" --token-timing ""
    RESULT_VARIABLE empty_result
    OUTPUT_QUIET
    ERROR_VARIABLE empty_error)
if(empty_result EQUAL 0 OR NOT empty_error MATCHES "token-timing path must not be empty")
    message(FATAL_ERROR "empty --token-timing value was not rejected: ${empty_error}")
endif()

execute_process(
    COMMAND "${CLI}" --token-timing "${WORK}/timing.ndjson" --moe-trace "${WORK}/trace.ndjson"
    RESULT_VARIABLE mutual_result
    OUTPUT_QUIET
    ERROR_VARIABLE mutual_error)
if(mutual_result EQUAL 0 OR NOT mutual_error MATCHES "mutually exclusive")
    message(FATAL_ERROR "token timing and MoE trace were not rejected: ${mutual_error}")
endif()

execute_process(
    COMMAND "${CLI}" --token-timing "${WORK}/timing.ndjson" --parallel 2
    RESULT_VARIABLE parallel_result
    OUTPUT_QUIET
    ERROR_VARIABLE parallel_error)
if(parallel_result EQUAL 0 OR NOT parallel_error MATCHES "requires one non-interactive sequence")
    message(FATAL_ERROR "parallel token timing was not rejected: ${parallel_error}")
endif()

execute_process(
    COMMAND "${CLI}" --token-timing "${WORK}/zero.ndjson" -n 0
    RESULT_VARIABLE zero_result
    OUTPUT_QUIET
    ERROR_VARIABLE zero_error)
if(zero_result EQUAL 0 OR NOT zero_error MATCHES "requires at least one generated token" OR EXISTS "${WORK}/zero.ndjson")
    message(FATAL_ERROR "zero-token timing was not rejected safely: ${zero_error}")
endif()

execute_process(
    COMMAND "${CLI}" -m "${WORK}/missing-model.gguf" --token-timing "${WORK}/failed-load.ndjson" -n 1
    RESULT_VARIABLE load_result
    OUTPUT_QUIET ERROR_QUIET)
if(load_result EQUAL 0 OR EXISTS "${WORK}/failed-load.ndjson")
    message(FATAL_ERROR "failed model load created token timing output or returned success")
endif()
file(GLOB stale_temps "${WORK}/failed-load.ndjson.tmp.*")
if(stale_temps)
    message(FATAL_ERROR "failed model load left temporary timing files: ${stale_temps}")
endif()
