/**
 * compressor/server.js
 * Local HTTP & Native FFmpeg Binary Server for CreativeCompress Pro (and full MRAID Suite)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const ffmpegEngine = require('./ffmpeg-engine.cjs');

const PORT = Number(process.env.PORT) || 3200;
const SUITE_ROOT = path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.zip': 'application/zip'
};

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function readJsonBody(req, maxBytes = 150 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('Payload exceeds maximum limit (150 MB)'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(new Error('Invalid JSON request body'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      return res.end();
    }

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    // FFmpeg Binary API Endpoints
    if (req.method === 'GET' && url.pathname === '/api/ffmpeg/status') {
      const status = ffmpegEngine.resolveFfmpeg();
      if (status.installed && !status.globalAvailable && status.binaryPath) {
        ffmpegEngine.ensureGlobalShim(status.binaryPath);
        return sendJson(res, 200, ffmpegEngine.resolveFfmpeg());
      }
      return sendJson(res, 200, status);
    }

    if (req.method === 'POST' && url.pathname === '/api/ffmpeg/install') {
      const result = await ffmpegEngine.installFfmpeg();
      return sendJson(res, 200, result);
    }

    if (req.method === 'POST' && url.pathname === '/api/ffmpeg/transcode') {
      const body = await readJsonBody(req);
      const result = await ffmpegEngine.transcodeVideoBase64(body);
      return sendJson(res, 200, result);
    }

    // Redirect root to /compressor/index.html
    if (url.pathname === '/' || url.pathname === '/index.html') {
      const compressorIndex = path.join(__dirname, 'index.html');
      if (url.pathname === '/') {
        res.writeHead(302, { Location: '/compressor/index.html' });
        return res.end();
      }
      const rootIndex = path.join(SUITE_ROOT, 'index.html');
      if (fs.existsSync(rootIndex)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(fs.readFileSync(rootIndex));
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(compressorIndex));
    }

    // Serve static files from SUITE_ROOT or __dirname
    let targetPath = path.resolve(SUITE_ROOT, '.' + decodeURIComponent(url.pathname));
    if (!targetPath.startsWith(SUITE_ROOT)) {
      return sendJson(res, 403, { error: 'Forbidden' });
    }

    if (!fs.existsSync(targetPath)) {
      // Fallback: check relative to compressor folder
      const localCandidate = path.resolve(__dirname, '.' + decodeURIComponent(url.pathname));
      if (localCandidate.startsWith(__dirname) && fs.existsSync(localCandidate)) {
        targetPath = localCandidate;
      }
    }

    if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
      targetPath = path.join(targetPath, 'index.html');
    }

    if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
      const ext = path.extname(targetPath).toLowerCase();
      const mime = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
      return res.end(fs.readFileSync(targetPath));
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error('[Compressor Server Error]:', err.message);
    sendJson(res, 500, { error: err.message });
  }
});

// Ensure global shim is linked on startup if FFmpeg is already present
const initStatus = ffmpegEngine.resolveFfmpeg();
if (initStatus.installed && initStatus.binaryPath) {
  ffmpegEngine.ensureGlobalShim(initStatus.binaryPath);
}

server.listen(PORT, '127.0.0.1', () => {
  const st = ffmpegEngine.resolveFfmpeg();
  console.log(`========================================================`);
  console.log(` CreativeCompress Pro Server: http://localhost:${PORT}/compressor/index.html`);
  console.log(` FFmpeg Binary Status       : ${st.installed ? 'ACTIVE (' + st.source + ')' : 'NOT INSTALLED (Install from UI)'}`);
  if (st.binaryPath) console.log(` FFmpeg Binary Path         : ${st.binaryPath}`);
  if (st.globalAvailable) console.log(` Global FFmpeg CLI          : ENABLED (${st.globalPath})`);
  console.log(`========================================================`);
});

