const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const SAMPLE_PATH = path.join(ROOT_DIR, 'sample.html');
const BACKUP_PATH = path.join(ROOT_DIR, 'sample.html.initial_bak');
const SAMPLE2_PATH = path.join(ROOT_DIR, 'sample-2.html');
const BACKUP2_PATH = path.join(ROOT_DIR, 'sample-2.html.initial_bak');

// Create initial backups if they don't exist
if (fs.existsSync(SAMPLE_PATH) && !fs.existsSync(BACKUP_PATH)) {
  fs.copyFileSync(SAMPLE_PATH, BACKUP_PATH);
  console.log('[Server] Created initial backup: sample.html.initial_bak');
}
if (fs.existsSync(SAMPLE2_PATH) && !fs.existsSync(BACKUP2_PATH)) {
  fs.copyFileSync(SAMPLE2_PATH, BACKUP2_PATH);
  console.log('[Server] Created initial backup: sample-2.html.initial_bak');
}

// Helper to parse layout blocks JSON from HTML (sample.html)
function extractLayoutBlocks(html) {
  const match = html.match(/id=["']__layout_blocks["'][^>]*>([\s\S]*?)<\/script>/);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch (e) {
      console.error('Error parsing __layout_blocks JSON:', e);
    }
  }
  return null;
}

// Helper to parse SIP builder config JSON from HTML (sample-2.html)
function extractSipBuilderConfig(html) {
  const match = html.match(/id=["']sip-builder-config["'][^>]*>([\s\S]*?)<\/script>/i);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch (e) {
      console.error('Error parsing sip-builder-config JSON:', e);
    }
  }
  return null;
}

// Scanner for standard MRAID layout templates (sample.html)
function scanHtmlElements(html) {
  const layoutData = extractLayoutBlocks(html);
  const blocksMap = new Map();
  if (layoutData && Array.isArray(layoutData.blocks)) {
    layoutData.blocks.forEach(b => {
      blocksMap.set(b.id, b);
    });
  }

  const elements = [];
  const elemRegex = /<([a-zA-Z0-9]+)\s+([^>]*?(?:id|data-block-id)=[^>]*?)>([\s\S]*?)<\/\1>/gi;
  let match;
  const seenIds = new Set();

  while ((match = elemRegex.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    const attrs = match[2];
    const innerHtml = match[3];

    if (['script', 'style', 'html', 'head', 'body', 'root', 'bgblur'].includes(tag)) continue;

    const idMatch = attrs.match(/id=["']([^"']+)["']/i);
    const blockIdMatch = attrs.match(/data-block-id=["']([^"']+)["']/i);
    const classMatch = attrs.match(/class=["']([^"']+)["']/i);
    const styleMatch = attrs.match(/style=["']([^"']+)["']/i);

    const id = idMatch ? idMatch[1] : null;
    const blockId = blockIdMatch ? blockIdMatch[1] : null;
    const className = classMatch ? classMatch[1] : '';
    const styleStr = styleMatch ? styleMatch[1] : '';

    if (!id && !blockId) continue;
    const key = id || blockId;
    if (seenIds.has(key)) continue;
    seenIds.add(key);

    if (['root', 'bgBlur', 'stage', 'overlay'].includes(id)) continue;

    const styleObj = {};
    if (styleStr) {
      styleStr.split(';').forEach(rule => {
        const [prop, val] = rule.split(':').map(s => s ? s.trim() : '');
        if (prop && val) styleObj[prop] = val;
      });
    }

    const textClean = innerHtml ? innerHtml.replace(/<[^>]*>/g, '').trim() : '';
    const layoutBlock = blockId ? blocksMap.get(blockId) : (id ? blocksMap.get(id) : null);

    let left = styleObj['left'] || (layoutBlock ? `${layoutBlock.x}%` : '');
    let top = styleObj['top'] || (layoutBlock ? `${layoutBlock.y}%` : '');
    let width = styleObj['width'] || (layoutBlock ? `${layoutBlock.width}%` : '');
    let height = styleObj['height'] || (layoutBlock && layoutBlock.height ? `${layoutBlock.height}%` : '');
    let transform = styleObj['transform'] || '';

    if (id === 'ctaBtn') {
      left = left || '50%';
      top = top || '81.5%';
      width = width || '82%';
      transform = transform || 'translate(-50%, -50%)';
    } else if (id === 'stripTop') {
      left = left || '0%';
      top = top || '0%';
      width = width || '100%';
      height = height || '5cqmin';
    } else if (id === 'stripBottom') {
      left = left || '0%';
      top = top || 'auto';
      width = width || '100%';
      height = height || '5cqmin';
    }

    elements.push({
      key,
      id,
      blockId,
      tag,
      className,
      text: textClean.slice(0, 80),
      fullText: textClean,
      hasLayoutBlock: !!layoutBlock,
      layoutBlock,
      inlineStyles: styleObj,
      rawStyleStr: styleStr,
      left,
      top,
      width,
      height,
      transform,
      fontSize: styleObj['font-size'] || (layoutBlock ? `${layoutBlock.fontSize}cqmin` : ''),
      color: styleObj['color'] || (layoutBlock ? layoutBlock.color : ''),
      fontWeight: styleObj['font-weight'] || (layoutBlock ? layoutBlock.fontWeight : ''),
      textAlign: styleObj['text-align'] || (layoutBlock ? layoutBlock.align : 'center'),
      zIndex: styleObj['z-index'] || '',
      opacity: styleObj['opacity'] || (layoutBlock && layoutBlock.opacity !== undefined ? layoutBlock.opacity : '1')
    });
  }

  return {
    templateType: 'mraid',
    elements,
    layoutBlocks: layoutData
  };
}

// Scanner for SIP Video JS dynamic templates (sample-2.html)
function scanSipHtmlElements(html) {
  const config = extractSipBuilderConfig(html);
  const elements = [];

  // Countdown timer element
  if (config && config.countdown) {
    const pos = config.countdown.position || {
      portrait: { x: 0.5, y: 0.2266 },
      landscape: { x: 0.7729, y: 0.5501 }
    };
    elements.push({
      key: 'sip-countdown',
      id: 'sip-countdown',
      blockId: 'countdown',
      tag: 'div',
      className: '',
      text: '{hh} : {mm} : {ss}',
      fullText: 'Countdown Timer ({hh} : {mm} : {ss})',
      isSip: true,
      sipType: 'countdown',
      position: pos,
      left: `${(pos.portrait.x * 100).toFixed(2)}%`,
      top: `${(pos.portrait.y * 100).toFixed(2)}%`,
      width: 'auto',
      height: 'auto',
      transform: 'none',
      fontSize: '4cqmin',
      color: '#000000',
      textAlign: 'center'
    });
  }

  // Dynamic date / text elements
  if (config && Array.isArray(config.dynamicTexts)) {
    config.dynamicTexts.forEach((d, idx) => {
      const id = `sip-dynamic-${d.id}`;
      const pos = d.position || {
        portrait: { x: 0.5, y: 0.2 + idx * 0.1 },
        landscape: { x: 0.77, y: 0.5 + idx * 0.1 }
      };
      const text = d.dateFormat?.customTokens || d.text || `Dynamic Text ${idx + 1}`;
      elements.push({
        key: id,
        id: id,
        blockId: d.id,
        tag: 'div',
        className: '',
        text: text,
        fullText: text,
        isSip: true,
        sipType: 'dynamicText',
        position: pos,
        left: `${(pos.portrait.x * 100).toFixed(2)}%`,
        top: `${(pos.portrait.y * 100).toFixed(2)}%`,
        width: 'auto',
        height: 'auto',
        transform: 'none',
        fontSize: '3cqmin',
        color: '#000000',
        textAlign: 'center'
      });
    });
  }

  return {
    templateType: 'sip',
    elements,
    sipConfig: config
  };
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API: GET /api/scan?file=sample.html or ?file=sample-2.html
  if (req.method === 'GET' && pathname === '/api/scan') {
    try {
      const targetFileName = parsedUrl.searchParams.get('file') || 'sample.html';
      const targetFilePath = path.join(ROOT_DIR, targetFileName);

      if (!fs.existsSync(targetFilePath)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `${targetFileName} not found` }));
        return;
      }

      const html = fs.readFileSync(targetFilePath, 'utf8');
      const isSip = html.includes('id="sip-builder-config"') || targetFileName.includes('sample-2');
      const scanResult = isSip ? scanSipHtmlElements(html) : scanHtmlElements(html);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        filename: targetFileName,
        fileSize: html.length,
        templateType: scanResult.templateType,
        elements: scanResult.elements,
        layoutBlocks: scanResult.layoutBlocks || null,
        sipConfig: scanResult.sipConfig || null,
        hasLayoutBlocks: !!scanResult.layoutBlocks,
        rawHtml: html
      }));
    } catch (err) {
      console.error('Scan error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // API: GET /api/raw-html?file=...
  if (req.method === 'GET' && pathname === '/api/raw-html') {
    try {
      const targetFileName = parsedUrl.searchParams.get('file') || 'sample.html';
      const targetFilePath = path.join(ROOT_DIR, targetFileName);
      if (!fs.existsSync(targetFilePath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File not found: ' + targetFileName);
        return;
      }
      const html = fs.readFileSync(targetFilePath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error loading file: ' + err.message);
    }
    return;
  }

  // API: GET /api/download?file=...
  if (req.method === 'GET' && pathname === '/api/download') {
    try {
      const targetFileName = parsedUrl.searchParams.get('file') || 'sample.html';
      const targetFilePath = path.join(ROOT_DIR, targetFileName);
      if (!fs.existsSync(targetFilePath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File not found');
        return;
      }
      const html = fs.readFileSync(targetFilePath, 'utf8');
      const dlName = targetFileName.replace(/\.html$/i, '_repositioned.html');
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${dlName}"`
      });
      res.end(html);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Download error: ' + err.message);
    }
    return;
  }

  // API: POST /api/upload
  if (req.method === 'POST' && pathname === '/api/upload') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        if (!payload || !payload.html || !payload.filename) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing filename or html content' }));
          return;
        }

        const safeFilename = path.basename(payload.filename);
        const targetFilePath = path.join(ROOT_DIR, safeFilename);

        if (!targetFilePath.startsWith(ROOT_DIR)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Forbidden path' }));
          return;
        }

        fs.writeFileSync(targetFilePath, payload.html, 'utf8');
        const backupPath = path.join(ROOT_DIR, `${safeFilename}.initial_bak`);
        if (!fs.existsSync(backupPath)) {
          fs.copyFileSync(targetFilePath, backupPath);
        }

        console.log(`[Server] Received and saved uploaded file: ${safeFilename} (${payload.html.length} bytes)`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, filename: safeFilename, size: payload.html.length }));
      } catch (err) {
        console.error('Upload error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // API: POST /api/save
  if (req.method === 'POST' && pathname === '/api/save') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        if (!payload || !payload.html) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing html content' }));
          return;
        }

        const targetFileName = payload.filename || 'repositioned_ad.html';
        const targetFilePath = path.join(ROOT_DIR, targetFileName);

        // Security check
        if (!targetFilePath.startsWith(ROOT_DIR)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Forbidden path' }));
          return;
        }

        // Backup existing file before overwriting
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const timedBackup = path.join(ROOT_DIR, `${targetFileName}.bak_${timestamp}`);
        if (fs.existsSync(targetFilePath)) {
          fs.copyFileSync(targetFilePath, timedBackup);
        }

        // Write new file
        fs.writeFileSync(targetFilePath, payload.html, 'utf8');
        console.log(`[Server] Saved updated ${targetFileName} (${payload.html.length} bytes). Backup: ${path.basename(timedBackup)}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          message: `Saved ${targetFileName} successfully!`,
          backup: path.basename(timedBackup),
          size: payload.html.length
        }));
      } catch (err) {
        console.error('Save error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // API: POST /api/reset
  if (req.method === 'POST' && pathname === '/api/reset') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        let payload = {};
        try { payload = JSON.parse(body || '{}'); } catch(e){}
        const targetFileName = payload.filename || 'repositioned_ad.html';
        const targetFilePath = path.join(ROOT_DIR, targetFileName);
        const backupPath = path.join(ROOT_DIR, `${targetFileName}.initial_bak`);

        if (!fs.existsSync(backupPath)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `No initial backup available for ${targetFileName}` }));
          return;
        }

        fs.copyFileSync(backupPath, targetFilePath);
        console.log(`[Server] Restored ${targetFileName} from initial backup`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: `Restored ${targetFileName} from initial backup` }));
      } catch (err) {
        console.error('Reset error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Static File Serving
  const PARENT_DIR = path.resolve(ROOT_DIR, '..');
  let reqPath = pathname === '/' ? '/index.html' : pathname;
  let filePath = path.resolve(ROOT_DIR, '.' + reqPath);
  
  if (!fs.existsSync(filePath)) {
    const parentFilePath = path.resolve(PARENT_DIR, '.' + reqPath);
    if (fs.existsSync(parentFilePath) && parentFilePath.startsWith(PARENT_DIR)) {
      filePath = parentFilePath;
    }
  }
  
  // Security check: ensure path is inside ROOT_DIR or PARENT_DIR
  if (!filePath.startsWith(ROOT_DIR) && !filePath.startsWith(PARENT_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // If serving any HTML ad file (except index.html), inject bridge.js for interactive canvas editing
  if (pathname.endsWith('.html') && pathname !== '/index.html' && fs.existsSync(filePath)) {
    fs.readFile(filePath, 'utf8', (err, content) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading ' + pathname);
        return;
      }
      let modified = content;
      if (modified.includes('id="sip-builder-config"')) {
        const dynamicRegex = /(const dateEl = document\.getElementById\(["'](sip-dynamic-[^"']+)["']\);)/g;
        modified = modified.replace(dynamicRegex, (match, p1, id) => {
          return `${p1} window.__sipPositions = window.__sipPositions || {}; window.__sipPositions["${id}"] = { portrait: datePositionPortrait, landscape: datePositionLandscape, update: updateDynamicDatePosition, el: dateEl };`;
        });
        const countdownRegex = /(function updateCountdownPosition\(\) \{[\s\S]*?\n\s*\})/;
        modified = modified.replace(countdownRegex, `$1\nwindow.__sipPositions = window.__sipPositions || {}; window.__sipPositions["sip-countdown"] = { portrait: countdownPositionPortrait, landscape: countdownPositionLandscape, update: updateCountdownPosition, el: countdownEl };`);
      }
      if (modified.includes('intro-scene-layer') || modified.includes('.useState("intro")')) {
        const mipRegex = /(\[([a-zA-Z0-9_$]+),\s*([a-zA-Z0-9_$]+)\]\s*=\s*[a-zA-Z0-9_$]+\.useState\(["']intro["']\))/g;
        modified = modified.replace(mipRegex, '$1; window.__setCreativeScene = $3; window.__internalSetScene = $3; window.__currentScene = $2;');
      }
      if (!modified.includes('id="__reposition_editor_styles"')) {
        const bridgeTag = '<script src="bridge.js"></script>\n</body>';
        modified = modified.replace(/<\/body>/i, bridgeTag);
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(modified);
    });
    return;
  }



  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 MRAID / SIP HTML Reposition App is running!`);
  console.log(`📡 Local URL: http://localhost:${PORT}`);
  console.log(`📂 Targets: sample.html & sample-2.html`);
  console.log(`======================================================\n`);
});
