/**
 * compressor/ffmpeg-engine.cjs
 * Shared Native FFmpeg Binary Resolver, Global/Local Installer, and H.264 Video Transcoder
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execSync, execFile } = require('child_process');

const COMPRESSOR_DIR = __dirname;
const TEMP_DIR = path.join(os.tmpdir(), 'creative_compress_ffmpeg');

function getGlobalNodeDir() {
  return path.dirname(process.execPath);
}

function getGlobalNodeModules() {
  try {
    const out = execSync('npm.cmd root -g', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).trim();
    if (out && fs.existsSync(out)) return out;
  } catch (_) {}
  return path.join(getGlobalNodeDir(), 'node_modules');
}

/**
 * Locate FFmpeg binary across local node_modules, global npm, and system PATH
 */
function resolveFfmpeg() {
  const candidates = [];

  // 1. Local compressor/node_modules/ffmpeg-static
  try {
    const localPkg = require.resolve('ffmpeg-static', { paths: [COMPRESSOR_DIR, path.resolve(COMPRESSOR_DIR, '..')] });
    const localBin = require(localPkg);
    if (localBin && fs.existsSync(localBin)) {
      candidates.push({ path: localBin, source: 'local (ffmpeg-static)' });
    }
  } catch (_) {}

  // 2. Global npm node_modules/ffmpeg-static
  try {
    const globalRoot = getGlobalNodeModules();
    const globalFfmpegModule = path.join(globalRoot, 'ffmpeg-static');
    if (fs.existsSync(globalFfmpegModule)) {
      const globalBin = require(globalFfmpegModule);
      if (globalBin && fs.existsSync(globalBin)) {
        candidates.push({ path: globalBin, source: 'global (ffmpeg-static)' });
      }
    }
  } catch (_) {}

  // 3. Global Node directory shim / binary (e.g. C:\nvm4w\nodejs\ffmpeg.exe)
  const nodeDir = getGlobalNodeDir();
  const nodeFfmpegExe = path.join(nodeDir, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
  if (fs.existsSync(nodeFfmpegExe)) {
    candidates.push({ path: nodeFfmpegExe, source: 'global PATH (nodejs)' });
  }

  // 4. System PATH (where.exe ffmpeg / which ffmpeg)
  try {
    const findCmd = process.platform === 'win32' ? 'where.exe ffmpeg' : 'which ffmpeg';
    const sysPaths = execSync(findCmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 4000 })
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean);
    for (const p of sysPaths) {
      if (fs.existsSync(p)) {
        candidates.push({ path: p, source: 'system PATH' });
      }
    }
  } catch (_) {}

  // Check if `ffmpeg` is globally callable on PATH
  let globalAvailable = false;
  let globalPath = null;
  try {
    const findCmd = process.platform === 'win32' ? 'where.exe ffmpeg' : 'which ffmpeg';
    const found = execSync(findCmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 4000 })
      .split(/\r?\n/)[0]?.trim();
    if (found) {
      globalAvailable = true;
      globalPath = found;
    }
  } catch (_) {}

  for (const cand of candidates) {
    try {
      const verOut = execSync(`"${cand.path}" -version`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 5000
      });
      const firstLine = (verOut.split(/\r?\n/)[0] || '').trim();
      const hasLibx264 = verOut.includes('libx264') || verOut.includes('--enable-gpl');
      return {
        installed: true,
        binaryPath: cand.path,
        source: cand.source,
        version: firstLine || 'FFmpeg active',
        hasLibx264,
        globalAvailable,
        globalPath: globalPath || (cand.source.includes('global') ? cand.path : null)
      };
    } catch (_) {}
  }

  return {
    installed: false,
    binaryPath: null,
    source: null,
    version: null,
    hasLibx264: false,
    globalAvailable: false,
    globalPath: null
  };
}

/**
 * Ensure global CLI shims (`ffmpeg.cmd`, `ffmpeg`, and `ffmpeg.exe`) exist in the global Node directory
 * so `ffmpeg` can be invoked globally from any terminal on the machine.
 */
function ensureGlobalShim(binaryPath) {
  if (!binaryPath || !fs.existsSync(binaryPath)) return { shimmed: false };
  const nodeDir = getGlobalNodeDir();
  const results = [];

  try {
    if (process.platform === 'win32') {
      // 1. Copy ffmpeg.exe directly into the global Node PATH directory (e.g. C:\nvm4w\nodejs\ffmpeg.exe)
      const targetExe = path.join(nodeDir, 'ffmpeg.exe');
      if (path.resolve(binaryPath).toLowerCase() !== path.resolve(targetExe).toLowerCase()) {
        fs.copyFileSync(binaryPath, targetExe);
      }
      results.push(targetExe);

      // 2. Also create ffmpeg.cmd wrapper in global Node directory
      const targetCmd = path.join(nodeDir, 'ffmpeg.cmd');
      const cmdContent = `@echo off\r\n"${binaryPath}" %*\r\n`;
      fs.writeFileSync(targetCmd, cmdContent, 'utf8');
      results.push(targetCmd);
    } else {
      const targetBin = path.join(nodeDir, 'ffmpeg');
      try {
        if (fs.existsSync(targetBin)) fs.unlinkSync(targetBin);
        fs.symlinkSync(binaryPath, targetBin);
        fs.chmodSync(targetBin, 0o755);
        results.push(targetBin);
      } catch (_) {}
    }
    return { shimmed: true, paths: results };
  } catch (err) {
    return { shimmed: false, error: err.message };
  }
}

/**
 * Install FFmpeg binary both globally and locally in compressor/
 */
function installFfmpeg() {
  return new Promise((resolve, reject) => {
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const logs = [];

    try {
      // Ensure package.json exists in compressor/
      const pkgPath = path.join(COMPRESSOR_DIR, 'package.json');
      if (!fs.existsSync(pkgPath)) {
        fs.writeFileSync(pkgPath, JSON.stringify({
          name: 'creative-compress-pro',
          version: '1.0.0',
          private: true,
          description: 'HTML Build & Base64 Video Optimizer with Native FFmpeg Engine',
          scripts: {
            start: 'node server.js',
            compress: 'node compress-videos.js'
          },
          dependencies: {}
        }, null, 2), 'utf8');
      }

      // 1. Install globally if not already in global node_modules
      logs.push('Installing ffmpeg-static globally (npm install -g ffmpeg-static)...');
      execSync(`${npmCmd} install -g ffmpeg-static`, {
        cwd: COMPRESSOR_DIR,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 180000
      });
      logs.push('Global ffmpeg-static package installed.');

      // 2. Install locally in compressor/
      logs.push('Installing ffmpeg-static locally in compressor/...');
      execSync(`${npmCmd} install --save ffmpeg-static`, {
        cwd: COMPRESSOR_DIR,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 180000
      });
      logs.push('Local ffmpeg-static package installed.');

      // 3. Resolve binary and register global PATH shim
      const status = resolveFfmpeg();
      if (status.installed && status.binaryPath) {
        const shimRes = ensureGlobalShim(status.binaryPath);
        if (shimRes.shimmed) {
          logs.push(`Linked global ffmpeg binary into PATH: ${shimRes.paths.join(', ')}`);
        }
      }

      const finalStatus = resolveFfmpeg();
      resolve({
        ok: finalStatus.installed,
        logs,
        status: finalStatus
      });
    } catch (err) {
      reject(new Error(`FFmpeg installation failed: ${err.message}`));
    }
  });
}

/**
 * Transcode a base64 video using native FFmpeg binary (H.264 / libx264 / yuv420p / faststart)
 */
function transcodeVideoBase64(options = {}) {
  return new Promise((resolve, reject) => {
    const status = resolveFfmpeg();
    if (!status.installed || !status.binaryPath) {
      return reject(new Error('FFmpeg binary is not installed. Click "Install & Enable FFmpeg" first.'));
    }

    const {
      b64,
      mime = 'mp4',
      crf = 26,
      bitrateKbps = 800,
      scale = 1.0,
      stripAudio = true,
      preset = 'slow'
    } = options;

    if (!b64 || typeof b64 !== 'string') {
      return reject(new Error('Missing base64 video payload'));
    }

    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }

    const id = crypto.randomBytes(6).toString('hex');
    const cleanExt = String(mime).replace(/[^a-z0-9]/gi, '') || 'mp4';
    const inputPath = path.join(TEMP_DIR, `in_${id}.${cleanExt}`);
    const outputPath = path.join(TEMP_DIR, `out_${id}.mp4`);

    const rawInputBuffer = Buffer.from(b64, 'base64');
    fs.writeFileSync(inputPath, rawInputBuffer);

    const safeCrf = Math.max(16, Math.min(36, Number(crf) || 26));
    const safeScale = Math.max(0.25, Math.min(1.0, Number(scale) || 1.0));
    const safeBitrate = Math.max(150, Math.min(8000, Number(bitrateKbps) || 800));
    const maxRateK = Math.round(safeBitrate * 1.35);
    const bufSizeK = Math.round(safeBitrate * 2.2);

    const vfFilter = safeScale < 0.999
      ? `scale=trunc(iw*${safeScale}/2)*2:trunc(ih*${safeScale}/2)*2`
      : 'scale=trunc(iw/2)*2:trunc(ih/2)*2';

    const args = [
      '-y',
      '-i', inputPath,
      '-c:v', 'libx264',
      '-crf', String(safeCrf),
      '-maxrate', `${maxRateK}k`,
      '-bufsize', `${bufSizeK}k`,
      '-preset', preset,
      '-vf', vfFilter,
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart'
    ];

    if (stripAudio) {
      args.push('-an');
    } else {
      args.push('-c:a', 'aac', '-b:a', '96k');
    }

    args.push(outputPath);

    execFile(status.binaryPath, args, { timeout: 120000, windowsHide: true }, (err) => {
      try {
        if (err || !fs.existsSync(outputPath)) {
          return reject(new Error(err ? err.message : 'FFmpeg failed to produce output MP4'));
        }
        const outBuffer = fs.readFileSync(outputPath);
        resolve({
          b64: outBuffer.toString('base64'),
          mime: 'mp4',
          originalBytes: rawInputBuffer.length,
          compressedBytes: outBuffer.length,
          ffmpegPath: status.binaryPath,
          args: args.join(' ')
        });
      } finally {
        try { if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath); } catch (_) {}
        try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch (_) {}
      }
    });
  });
}

module.exports = {
  resolveFfmpeg,
  ensureGlobalShim,
  installFfmpeg,
  transcodeVideoBase64
};

