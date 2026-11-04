@echo off
chcp 65001 >nul
node "%~dp0Launch-Keshev.mjs" start
if errorlevel 1 pause
