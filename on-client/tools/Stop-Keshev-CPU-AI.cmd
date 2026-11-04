@echo off
chcp 65001 >nul
setlocal
set "NODE_BIN=node.exe"
if exist "%~dp0..\..\runtime\node.exe" set "NODE_BIN=%~dp0..\..\runtime\node.exe"
"%NODE_BIN%" "%~dp0Launch-Keshev.mjs" stop
if errorlevel 1 pause
