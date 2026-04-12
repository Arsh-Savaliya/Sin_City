@echo off
cd /d "%~dp0"
start "Sin City Server" node server.js
echo Server started. Open http://localhost:5000 in your browser.
pause