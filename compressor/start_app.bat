@echo off
title CreativeCompress Pro - Native FFmpeg Engine
cd /d "%~dp0"
echo Starting CreativeCompress Pro with Native FFmpeg Binary Engine...
start "" "http://localhost:3200/compressor/index.html"
node server.js
pause

