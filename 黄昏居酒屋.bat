@echo off
REM ============================================================
REM Twilight Izakaya one-click launcher
REM Usage:
REM 1. Double-click this file, or run it from cmd.
REM 2. The script will cd into the project root automatically.
REM 3. It will detect free ports, start frontend and backend,
REM    then open the default browser after both are ready.
REM ============================================================

cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0twilight_izakaya_launcher.ps1"
if errorlevel 1 (
  echo.
  pause
  exit /b 1
)