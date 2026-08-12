@echo off
setlocal
if "%~1"=="" (
  echo Usage: start-erp-bridge.cmd https://YOUR-PREVIEW.vercel.app
  exit /b 1
)
where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or newer is required.
  exit /b 1
)
node.exe "%~dp0erp-bridge.js" --origin "%~1"
