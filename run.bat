@echo off
title Smart Recruitment Suite - Development Runner
cd /d "%~dp0\.."

:: Prepend custom Node wrapper directory to path to bypass Windows Explorer environment caching
set PATH=C:\Users\hossa\AppData\Roaming\Antigravity\bin;%PATH%

if not exist node_modules (
    echo [INFO] node_modules not found. Installing dependencies via pnpm...
    call "C:\Users\hossa\AppData\Local\pnpm\bin\pnpm.cmd" install
)

echo [INFO] Launching local development server...
call "C:\Users\hossa\AppData\Local\pnpm\bin\pnpm.cmd" run dev
pause
