@echo off
REM  Set NOPAUSE=1 to skip the prompts below when running this script
REM  non-interactively (CI, an agent over SSH, a wrapper script). Without
REM  the guard the script blocks silently at `pause` instead of exiting.
setlocal
echo Starting ik_llama.cpp Dashboard...
echo.
python "%~dp0dashboard\dashboard_server.py" %*
if not defined NOPAUSE pause
