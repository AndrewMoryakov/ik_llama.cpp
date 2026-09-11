@echo off
REM  Set NOPAUSE=1 to skip the prompts below when running this script
REM  non-interactively (CI, an agent over SSH, a wrapper script). Without
REM  the guard the script blocks silently at `pause` instead of exiting.
REM Build script for Intel Raptor Lake mobile (e.g. i7-1360p), CPU-only.
REM
REM Differences from build_zen4.bat / build_now.bat:
REM   - No AVX-512 (Intel removed AVX-512 from consumer chips since Alder Lake).
REM   - AVX2 + AVX-VNNI 256-bit path (HAVE_VNNI256 will be defined via
REM     __AVXVNNI__).
REM   - GGML_NATIVE=ON so the compiler picks up F16C and any other 13th-gen
REM     extensions the chip supports.
REM   - No CUDA. No mention of CUDA paths.
REM
REM Paths are resolved relative to this script via %~dp0 so the same script
REM works regardless of where the repo is cloned on the laptop.

call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" >NUL 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [FAILED] Could not find vcvars64.bat at the default Visual Studio 2022 Community location.
    echo Adjust the vcvars64.bat call above for your VS installation, or run it
    echo manually before invoking the cmake step below.
    exit /b 1
)

set CMAKE="C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe"
set NINJA="C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\IDE\CommonExtensions\Microsoft\CMake\Ninja\ninja.exe"
set SCRIPT_DIR=%~dp0
set SRC=%SCRIPT_DIR:~0,-1%
set BUILD=%SCRIPT_DIR%build

echo =============================================
echo   ik_llama.cpp build (Raptor Lake mobile CPU)
echo =============================================
echo   SRC   = %SRC%
echo   BUILD = %BUILD%
echo(

REM  NOTE (2026-09-08): the option upstream provides is GGML_AVXVNNI, with no
REM  underscore before VNNI. The fork-local spelling GGML_AVX_VNNI is silently
REM  ignored - cmake only says "Manually-specified variables were not used by
REM  the project". Verified by configuring both spellings against this tree.
echo === CMAKE CONFIGURE ===
%CMAKE% -S "%SRC%" -B "%BUILD%" -G Ninja -DCMAKE_MAKE_PROGRAM=%NINJA% ^
    -DCMAKE_BUILD_TYPE=Release ^
    -DGGML_NATIVE=ON ^
    -DGGML_AVX2=ON ^
    -DGGML_AVXVNNI=ON ^
    -DGGML_CUDA=OFF 2>&1
set CONF_EXIT=%ERRORLEVEL%
echo === CONFIGURE EXIT: %CONF_EXIT% ===
echo(

if %CONF_EXIT% NEQ 0 (
    echo [FAILED] Configure failed with code %CONF_EXIT%
    echo(
    if not defined NOPAUSE pause
    exit /b %CONF_EXIT%
)

echo === CMAKE BUILD ===
%CMAKE% --build "%BUILD%" --config Release -j 8 2>&1
set BUILD_EXIT=%ERRORLEVEL%
echo(

echo =============================================
if %BUILD_EXIT% EQU 0 (
    echo   [SUCCESS] Build completed successfully
) else (
    echo   [FAILED] Build failed with code %BUILD_EXIT%
)
echo =============================================
echo(
dir "%BUILD%\bin\llama-server.exe" "%BUILD%\bin\llama-cli.exe" "%BUILD%\bin\llama-quantize.exe" 2>NUL
echo(
if not defined NOPAUSE pause

rem Without this the script ends on pause and returns its code, so a failed
rem build reported success to whoever called the script.
exit /b %BUILD_EXIT%
