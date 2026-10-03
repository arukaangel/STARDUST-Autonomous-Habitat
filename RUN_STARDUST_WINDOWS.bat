@echo off
cd /d "%~dp0"
if not exist node_modules goto setup
if not exist .venv\Scripts\python.exe goto setup
start "STARDUST CORE" cmd /k "cd /d "%~dp0backend" && ..\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8000"
timeout /t 2 /nobreak >nul
start "STARDUST WEBSITE" cmd /k "cd /d "%~dp0" && npm.cmd run dev"
timeout /t 2 /nobreak >nul
start "" http://localhost:5173
exit /b 0
:setup
call SETUP_AND_RUN_WINDOWS.bat
