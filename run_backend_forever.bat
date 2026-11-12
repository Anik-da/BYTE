@echo off
title BYTE Backend Engine - 24/7 Background Launcher
cd /d "%~dp0"
echo Launching BYTE 24/7 Persistent Backend & Continuous Voice Engine...
start "" pythonw backend/run_forever.py
if errorlevel 1 (
    python backend/run_forever.py
)
