@echo off
chcp 65001 >nul
title New client - Salon POS
cd /d "%~dp0.."
if not exist node_modules (
  echo Installing build dependencies once...
  call npm install
)
call npm run new-client
echo.
pause
