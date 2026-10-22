@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-admin.ps1"
if errorlevel 1 (
    echo.
    echo Backend-i nuk u nis. Lexo gabimin me lart dhe provo perseri.
    pause
)
