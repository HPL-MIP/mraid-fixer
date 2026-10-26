@echo off
cd /d "%~dp0"
if not exist node_modules call npm install
if errorlevel 1 exit /b 1
echo Open http://localhost:3100 in your browser.
node server.cjs
pause
