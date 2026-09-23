@echo off
REM CPU-only build helper for AVX-512-capable CPUs (AMD Zen4 / Intel
REM Sapphire Rapids+) on Windows + MSVC. Enables the IQK GEMM kernels
REM gated by HAVE_FANCY_SIMD (see docs\build.md "CPU build flags for AVX-512").
REM
REM GGML_NATIVE=ON is enough: since upstream #2430 (ac7f1feb) FindSIMD.cmake
REM probes AVX512-VNNI/VBMI/BF16 under MSVC and enables the matching options.
REM Check that llama-cli prints "HAVE_FANCY_SIMD is defined" at model load.
REM
REM Run from a Visual Studio "x64 Native Tools Command Prompt" so that
REM cl.exe and the rest of the MSVC toolchain are on PATH.
REM
REM Usage:
REM   scripts\build-zen.bat [build-dir]
REM
REM Default build directory is "build".

setlocal

if "%~1"=="" (set BUILD_DIR=build) else (set BUILD_DIR=%~1)

cmake -B "%BUILD_DIR%" -G "NMake Makefiles" ^
    -DCMAKE_BUILD_TYPE=Release ^
    -DGGML_NATIVE=ON
if errorlevel 1 exit /b 1

cmake --build "%BUILD_DIR%" --config Release
