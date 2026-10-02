@echo off
chcp 65001 > nul
title Instalador Sebastian G - Estudio POS
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\installer.ps1"
if %errorlevel% neq 0 (
    echo.
    echo Ocurrió un error al instalar. Por favor ejecuta este archivo como Administrador si es necesario.
    pause
)
