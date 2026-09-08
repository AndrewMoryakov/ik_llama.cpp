@echo off
setlocal
echo Starting ik_llama.cpp Dashboard...
echo.
python "%~dp0dashboard\dashboard_server.py" %*
pause
