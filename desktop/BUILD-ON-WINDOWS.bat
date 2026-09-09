@echo off
title Lane — build Windows installer
cd /d "%~dp0"
echo Installing Electron and electron-builder. This needs Node.js 20+.
call npm install
if errorlevel 1 goto fail
echo Building Lane Setup.exe
call npm run dist
if errorlevel 1 goto fail
echo.
echo Done. Installer is in desktop\dist\Lane Setup.exe
explorer dist
goto end
:fail
echo Build failed. Install Node.js LTS from https://nodejs.org and try again.
pause
:end
pause
