@echo off
echo Starting ik_llama.cpp Dashboard Server...
echo.
python "%~dp0dashboard_server.py" %*
pause
