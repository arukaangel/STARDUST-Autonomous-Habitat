@echo off
setlocal
cd /d "%~dp0"
title STARDUST Setup

echo =====================================================
echo   STARDUST - first-time setup and launch
echo =====================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or not in PATH.
  echo Install Node.js LTS from nodejs.org, then run this file again.
  pause
  exit /b 1
)

set PY=python
where python >nul 2>nul
if errorlevel 1 (
  set PY=py
  where py >nul 2>nul
  if errorlevel 1 (
    echo [ERROR] Python 3 is not installed or not in PATH.
    echo Install Python 3.11+ and enable "Add Python to PATH".
    pause
    exit /b 1
  )
)

if not exist node_modules (
  echo [1/4] Installing website packages...
  call npm.cmd install
  if errorlevel 1 goto :fail
) else (
  echo [1/4] Website packages already installed.
)

if not exist .venv\Scripts\python.exe (
  echo [2/4] Creating Python environment...
  %PY% -m venv .venv
  if errorlevel 1 goto :fail
)

echo [3/4] Installing STARDUST Core dependencies...
call .venv\Scripts\python.exe -m pip install -q -r backend\requirements.txt
if errorlevel 1 goto :fail

echo [4/4] Launching backend and website...
start "STARDUST CORE" cmd /k "cd /d "%~dp0backend" && ..\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8000"
timeout /t 3 /nobreak >nul
start "STARDUST WEBSITE" cmd /k "cd /d "%~dp0" && npm.cmd run dev"
timeout /t 3 /nobreak >nul
start "" http://localhost:5173

echo.
echo STARDUST is starting. Keep both terminal windows open.
echo Website: http://localhost:5173
echo Core API: http://127.0.0.1:8000/docs
echo.
pause
exit /b 0

:fail
echo.
echo [ERROR] Setup failed. Copy the last error from this window and send it to ChatGPT.
pause
exit /b 1
