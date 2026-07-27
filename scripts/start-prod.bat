@echo off
title Smart Recruitment Suite - Production Runner
cd /d "%~dp0\.."

:: Prepend custom Node wrapper directory to path to bypass Windows Explorer environment caching
set PATH=C:\Users\hossa\AppData\Roaming\Antigravity\bin;%PATH%

echo [INFO] Building production client and server bundles...
call "C:\Users\hossa\AppData\Local\pnpm\bin\pnpm.cmd" run build

echo [INFO] Starting production server...
set NODE_ENV=production
node dist/server.cjs
pause
