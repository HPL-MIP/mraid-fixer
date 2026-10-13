(function () {
  'use strict';

  // Application State
  const state = {
    dspLimitMb: 3.4,
    crf: 26,
    bitrateKbps: 800,
    scale: 1.0,
    transcodeVideo: true,
    stripAudio: true,
    deduplicateVideo: true,
    minifyHtml: true,
    minifyCss: true,
    minifyJs: true,
    compressImages: true,
    files: [], // Array of FileItem objects
  };

  class FileItem {
    constructor(id, file, rawContent) {
      this.id = id;
      this.file = file;
      this.name = file.name;
      this.originalSize = file.size || rawContent.length;
      this.rawContent = rawContent;
      this.compressedContent = null;
      this.compressedSize = null;
      this.status = 'ready'; // ready, compressing, completed, error
      this.statusMsg = 'Ready to compress';
      this.progress = 0;
      this.assets = {
        videos: [],
        images: [],
        htmlChars: 0,
        cssChars: 0,
        jsChars: 0
      };
      this.analyzeAssets();
    }

    analyzeAssets() {
      // Base64 Video detection
      const videoRegex = /data:video\/([a-zA-Z0-9.-]+);base64,([A-Za-z0-9+/=]+)/g;
      let vMatch;
      let totalVideoBytes = 0;
      while ((vMatch = videoRegex.exec(this.rawContent)) !== null) {
        const b64 = vMatch[2];
        const size = Math.round((b64.length * 3) / 4);
        totalVideoBytes += size;
        this.assets.videos.push({
          mime: vMatch[1],
          b64: b64,
          size: size,
          fullMatch: vMatch[0]
        });
      }

      // Base64 Image detection
      const imgRegex = /data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)/g;
      let iMatch;
      let totalImageBytes = 0;
      while ((iMatch = imgRegex.exec(this.rawContent)) !== null) {
        const b64 = iMatch[2];
        const size = Math.round((b64.length * 3) / 4);
        if (size > 4000) {
          totalImageBytes += size;
          this.assets.images.push({
            mime: iMatch[1],
            b64: b64,
            size: size,
            fullMatch: iMatch[0]
          });
        }
      }

      // Inline Styles
      const styleMatches = this.rawContent.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
      this.assets.cssChars = styleMatches.reduce((acc, str) => acc + str.length, 0);

      // Inline Scripts
      const scriptMatches = this.rawContent.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
      this.assets.jsChars = scriptMatches.reduce((acc, str) => acc + str.length, 0);

      this.assets.htmlChars = this.rawContent.length - totalVideoBytes - totalImageBytes;
    }
  }

  // DOM Elements
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const btnBrowseFiles = document.getElementById('btnBrowseFiles');
  const btnLoadSample = document.getElementById('btnLoadSample');
  const queueSection = document.getElementById('queueSection');
  const fileCardsList = document.getElementById('fileCardsList');
  const statFileCount = document.getElementById('statFileCount');
  const statInputSize = document.getElementById('statInputSize');
  const statOutputSize = document.getElementById('statOutputSize');
  const statSavings = document.getElementById('statSavings');
  const btnClearAll = document.getElementById('btnClearAll');
  const btnCompressAllTop = document.getElementById('btnCompressAllTop');
  const btnCompressAllMain = document.getElementById('btnCompressAllMain');
  const btnDownloadZipTop = document.getElementById('btnDownloadZipTop');
  const btnDownloadZipMain = document.getElementById('btnDownloadZipMain');
  const topQueueCount = document.getElementById('topQueueCount');
  const toastBox = document.getElementById('toastBox');

  // Sliders & Controls
  const sliderBitrate = document.getElementById('sliderBitrate');
  const bitrateDisplay = document.getElementById('bitrateDisplay');
  const chkTranscodeVideo = document.getElementById('chkTranscodeVideo');
  const chkStripAudio = document.getElementById('chkStripAudio');
  const chkDeduplicateVideo = document.getElementById('chkDeduplicateVideo');
  const chkMinifyHtml = document.getElementById('chkMinifyHtml');
  const chkMinifyCss = document.getElementById('chkMinifyCss');
  const chkMinifyJs = document.getElementById('chkMinifyJs');
  const chkCompressImages = document.getElementById('chkCompressImages');

  // Modals
  const modalPreview = document.getElementById('modalPreview');
  const previewIframe = document.getElementById('previewIframe');
  const previewContainer = document.getElementById('previewContainer');
  const modalInspect = document.getElementById('modalInspect');
  const inspectBody = document.getElementById('inspectBody');

  // Notification Toast Helper
  function showToast(msg) {
    if (!toastBox) return;
    toastBox.textContent = msg;
    toastBox.classList.add('show');
    setTimeout(() => toastBox.classList.remove('show'), 3500);
  }

  // Byte Formatter
  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const dm = 2;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  function onSettingsChanged() {
    renderQueue();
    if (state.files.some(f => f.status === 'completed')) {
      showToast('Settings updated! Click "Re-compress" to apply changes.');
    }
  }

  // DSP Limit Presets
  document.querySelectorAll('#dspPresetGroup .pill-opt').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#dspPresetGroup .pill-opt').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const val = pill.getAttribute('data-dsp');
      if (val === 'custom') {
        const input = prompt('Enter custom target file limit in Megabytes (MB):', '3.4');
        const parsed = parseFloat(input);
        if (!isNaN(parsed) && parsed > 0) {
          state.dspLimitMb = parsed;
          pill.querySelector('span').textContent = parsed.toFixed(1) + ' MB';
        }
      } else {
        state.dspLimitMb = parseFloat(val);
      }
      renderQueue();
    });
  });

  // CRF Video Presets
  document.querySelectorAll('#crfPresetGroup .pill-opt').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#crfPresetGroup .pill-opt').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.crf = parseInt(pill.getAttribute('data-crf'), 10);
      state.bitrateKbps = parseInt(pill.getAttribute('data-bitrate'), 10);
      if (sliderBitrate) sliderBitrate.value = state.bitrateKbps;
      if (bitrateDisplay) bitrateDisplay.textContent = state.bitrateKbps + ' kbps';
      onSettingsChanged();
    });
  });

  // Bitrate Slider
  if (sliderBitrate) {
    sliderBitrate.addEventListener('input', (e) => {
      state.bitrateKbps = parseInt(e.target.value, 10);
      if (bitrateDisplay) bitrateDisplay.textContent = state.bitrateKbps + ' kbps';
    });
    sliderBitrate.addEventListener('change', () => {
      onSettingsChanged();
    });
  }

  // Resolution Scale Presets
  document.querySelectorAll('#scalePresetGroup .pill-opt').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#scalePresetGroup .pill-opt').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.scale = parseFloat(pill.getAttribute('data-scale'));
      onSettingsChanged();
    });
  });

  // Checkbox Toggles
  if (chkTranscodeVideo) chkTranscodeVideo.addEventListener('change', e => { state.transcodeVideo = e.target.checked; onSettingsChanged(); });
  if (chkStripAudio) chkStripAudio.addEventListener('change', e => { state.stripAudio = e.target.checked; onSettingsChanged(); });
  if (chkDeduplicateVideo) chkDeduplicateVideo.addEventListener('change', e => { state.deduplicateVideo = e.target.checked; onSettingsChanged(); });
  if (chkMinifyHtml) chkMinifyHtml.addEventListener('change', e => { state.minifyHtml = e.target.checked; onSettingsChanged(); });
  if (chkMinifyCss) chkMinifyCss.addEventListener('change', e => { state.minifyCss = e.target.checked; onSettingsChanged(); });
  if (chkMinifyJs) chkMinifyJs.addEventListener('change', e => { state.minifyJs = e.target.checked; onSettingsChanged(); });
  if (chkCompressImages) chkCompressImages.addEventListener('change', e => { state.compressImages = e.target.checked; onSettingsChanged(); });

  // Synchronous, Reliable Drag & Drop
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
  }, false);

  window.addEventListener('drop', (e) => {
    e.preventDefault();
    if (dropzone) dropzone.classList.remove('dragover');
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleIncomingFiles(Array.from(e.dataTransfer.files));
    }
  }, false);

  if (dropzone) {
    dropzone.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    }, false);

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
      dropzone.classList.add('dragover');
    }, false);

    dropzone.addEventListener('dragleave', (e) => {
      if (!dropzone.contains(e.relatedTarget)) {
        dropzone.classList.remove('dragover');
      }
    }, false);

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');

      const dt = e.dataTransfer;
      if (!dt) return;

      const files = dt.files ? Array.from(dt.files) : [];
      if (files.length > 0) {
        handleIncomingFiles(files);
      } else {
        showToast('⚠️ No files detected in drop');
      }
    }, false);

    // Clicking anywhere in dropzone opens file dialog
    dropzone.addEventListener('click', (e) => {
      if (e.target.closest('#btnLoadSample')) return;
      if (fileInput) fileInput.click();
    });

    // Keyboard trigger (Enter / Space)
    dropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (fileInput) fileInput.click();
      }
    });
  }

  if (btnBrowseFiles) {
    btnBrowseFiles.addEventListener('click', (e) => {
      e.stopPropagation();
      if (fileInput) fileInput.click();
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length > 0) {
        handleIncomingFiles(Array.from(fileInput.files));
        fileInput.value = '';
      }
    });
  }

  if (btnLoadSample) {
    btnLoadSample.addEventListener('click', () => {
      generateAndLoadSampleAd();
    });
  }

  // Process Incoming Files
  function handleIncomingFiles(fileList) {
    const htmlFiles = fileList.filter(f => f.name && (f.name.toLowerCase().endsWith('.html') || f.name.toLowerCase().endsWith('.htm')));
    if (htmlFiles.length === 0) {
      showToast('⚠️ Please upload or drop .html or .htm files!');
      return;
    }

    let loaded = 0;
    htmlFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        const id = 'f_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        const item = new FileItem(id, file, content);
        state.files.push(item);
        loaded++;
        if (loaded === htmlFiles.length) {
          renderQueue();
          showToast(`Added ${htmlFiles.length} file(s) to compression queue`);
        }
      };
      reader.readAsText(file);
    });
  }

  // Render Queue UI
  function renderQueue() {
    if (!queueSection) return;

    if (state.files.length === 0) {
      queueSection.classList.remove('visible');
      if (btnClearAll) btnClearAll.style.display = 'none';
      if (btnCompressAllTop) btnCompressAllTop.style.display = 'none';
      if (btnDownloadZipTop) btnDownloadZipTop.style.display = 'none';
      return;
    }

    queueSection.classList.add('visible');
    if (btnClearAll) btnClearAll.style.display = 'inline-flex';
    if (btnCompressAllTop) btnCompressAllTop.style.display = 'inline-flex';
    if (btnDownloadZipTop) btnDownloadZipTop.style.display = 'inline-flex';
    if (topQueueCount) topQueueCount.textContent = state.files.length;

    const allCompleted = state.files.length > 0 && state.files.every(f => f.status === 'completed');
    if (btnCompressAllTop) {
      if (allCompleted) {
        btnCompressAllTop.innerHTML = `🔄 Re-compress All (<span id="topQueueCount">${state.files.length}</span>)`;
        btnCompressAllTop.title = 'Re-compress all files with current settings';
      } else {
        btnCompressAllTop.innerHTML = `⚡ Compress All (<span id="topQueueCount">${state.files.length}</span>)`;
        btnCompressAllTop.title = 'Compress all uncompressed files';
      }
    }
    if (btnCompressAllMain) {
      if (allCompleted) {
        btnCompressAllMain.innerHTML = `🔄 Re-compress All Files`;
        btnCompressAllMain.title = 'Re-compress all files with current settings';
      } else {
        btnCompressAllMain.innerHTML = `⚡ Compress All Files`;
        btnCompressAllMain.title = 'Compress all uncompressed files';
      }
    }

    // Totals
    let totalIn = 0;
    let totalOut = 0;

    state.files.forEach(f => {
      totalIn += f.originalSize;
      if (f.compressedSize) {
        totalOut += f.compressedSize;
      } else {
        totalOut += f.originalSize;
      }
    });

    if (statFileCount) statFileCount.textContent = state.files.length;
    if (statInputSize) statInputSize.textContent = formatBytes(totalIn);
    if (statOutputSize) statOutputSize.textContent = formatBytes(totalOut);

    const savedBytes = totalIn - totalOut;
    const savedPercent = totalIn > 0 && totalOut < totalIn ? ((savedBytes / totalIn) * 100).toFixed(1) : 0;
    if (statSavings) statSavings.textContent = `${savedPercent}% (${formatBytes(savedBytes)})`;

    // Render Cards
    if (!fileCardsList) return;
    fileCardsList.innerHTML = '';

    state.files.forEach(item => {
      const card = document.createElement('div');
      card.className = `file-card ${item.status === 'completed' ? 'completed' : ''}`;
      card.id = `card_${item.id}`;

      const isOverLimit = item.compressedSize ? (item.compressedSize > (state.dspLimitMb * 1024 * 1024)) : (item.originalSize > (state.dspLimitMb * 1024 * 1024));
      const limitClass = item.compressedSize ? (isOverLimit ? 'fail' : 'pass') : 'warn';
      const limitText = item.compressedSize ? (isOverLimit ? `OVER ${state.dspLimitMb}MB` : `PASS ≤ ${state.dspLimitMb}MB`) : `TARGET ≤ ${state.dspLimitMb}MB`;

      const videoCount = item.assets.videos.length;
      const imageCount = item.assets.images.length;
      const savingPct = item.compressedSize ? ((1 - (item.compressedSize / item.originalSize)) * 100).toFixed(1) : null;

      card.innerHTML = `
        <div class="fc-top-row">
          <div class="fc-file-icon">📄</div>
          <div class="fc-file-info">
            <div class="fc-file-name">
              ${escapeHtml(item.name)}
            </div>
            <div class="fc-file-tags">
              <span class="fc-tag">Original: ${formatBytes(item.originalSize)}</span>
              ${videoCount > 0 ? `<span class="fc-tag tag-video">🎬 ${videoCount} Video (${formatBytes(item.assets.videos.reduce((a,v) => a + v.size, 0))})</span>` : ''}
              ${imageCount > 0 ? `<span class="fc-tag tag-image">🖼️ ${imageCount} Images</span>` : ''}
              ${item.assets.jsChars > 0 ? `<span class="fc-tag">⚡ JS ${formatBytes(item.assets.jsChars)}</span>` : ''}
            </div>
          </div>

          <div class="fc-size-compare">
            <span class="fc-size-orig">${formatBytes(item.originalSize)}</span>
            <span class="fc-arrow">➔</span>
            <span class="fc-size-comp">${item.compressedSize ? formatBytes(item.compressedSize) : '—'}</span>
            ${savingPct ? `<span class="fc-badge-saving">-${savingPct}%</span>` : ''}
            <span class="fc-badge-limit ${limitClass}">${limitText}</span>
          </div>

          <div class="fc-actions">
            ${item.status !== 'completed' ? `
              <button class="btn-fc btn-fc-primary btn-compress-single" data-id="${item.id}">
                ⚡ Compress
              </button>
            ` : `
              <button class="btn-fc btn-fc-green btn-download-single" data-id="${item.id}" title="Download compressed creative">
                💾 Download
              </button>
              <button class="btn-fc btn-fc-recompress btn-recompress-single" data-id="${item.id}" title="Compress again with current settings">
                🔄 Re-compress
              </button>
            `}
            <button class="btn-fc btn-preview-single" data-id="${item.id}" title="Preview Sandbox">
              👁️ Preview
            </button>
            <button class="btn-fc btn-inspect-single" data-id="${item.id}" title="Inspect Assets">
              🔍 Assets
            </button>
            <button class="btn-fc btn-fc-del btn-remove-single" data-id="${item.id}" title="Remove file">
              ✕
            </button>
          </div>
        </div>

        <div class="fc-progress-wrap ${item.status === 'compressing' ? 'active' : ''}" id="prog_${item.id}">
          <div class="fc-progress-bar-bg">
            <div class="fc-progress-bar-fill" style="width: ${item.progress}%;"></div>
          </div>
          <div class="fc-progress-status">
            <span class="status-msg">${item.statusMsg}</span>
            <span>${item.progress}%</span>
          </div>
        </div>
      `;

      fileCardsList.appendChild(card);
    });

    attachCardEventListeners();
  }

  function attachCardEventListeners() {
    document.querySelectorAll('.btn-compress-single').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const item = state.files.find(f => f.id === id);
        if (item) compressFileItem(item);
      });
    });

    document.querySelectorAll('.btn-recompress-single').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const item = state.files.find(f => f.id === id);
        if (item) compressFileItem(item);
      });
    });

    document.querySelectorAll('.btn-download-single').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const item = state.files.find(f => f.id === id);
        if (item) downloadSingleFile(item);
      });
    });

    document.querySelectorAll('.btn-preview-single').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const item = state.files.find(f => f.id === id);
        if (item) openPreviewModal(item);
      });
    });

    document.querySelectorAll('.btn-inspect-single').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const item = state.files.find(f => f.id === id);
        if (item) openInspectModal(item);
      });
    });

    document.querySelectorAll('.btn-remove-single').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        state.files = state.files.filter(f => f.id !== id);
        renderQueue();
      });
    });
  }

  if (btnClearAll) {
    btnClearAll.addEventListener('click', () => {
      if (confirm('Clear all files from the queue?')) {
        state.files = [];
        renderQueue();
      }
    });
  }

  // Compress All Handler (also handles Re-compress All when settings change)
  if (btnCompressAllTop) btnCompressAllTop.addEventListener('click', compressAll);
  if (btnCompressAllMain) btnCompressAllMain.addEventListener('click', compressAll);

  async function compressAll() {
    const uncompressed = state.files.filter(f => f.status !== 'completed');
    const targets = uncompressed.length > 0 ? uncompressed : state.files;

    if (targets.length === 0) {
      showToast('No files in queue to compress!');
      return;
    }

    if (btnCompressAllTop) btnCompressAllTop.disabled = true;
    if (btnCompressAllMain) btnCompressAllMain.disabled = true;

    const isRecompress = uncompressed.length === 0;
    showToast(`${isRecompress ? 'Re-compressing' : 'Compressing'} ${targets.length} creative(s) with current settings...`);

    for (const item of targets) {
      await compressFileItem(item);
    }

    if (btnCompressAllTop) btnCompressAllTop.disabled = false;
    if (btnCompressAllMain) btnCompressAllMain.disabled = false;
    showToast('All build files successfully processed!');
  }

  // Safe String Replacer (immune to $ pattern expansions and replaces all occurrences)
  function safeReplaceAll(str, search, replacement) {
    if (!str || !search) return str;
    return str.split(search).join(replacement);
  }

  // File Compression Engine
  async function compressFileItem(item) {
    item.status = 'compressing';
    item.progress = 5;
    item.statusMsg = 'Analyzing DOM and embedded assets...';
    updateCardProgress(item);

    let content = item.rawContent;

    // 1. Transcode Videos (if enabled and present)
    if (state.transcodeVideo && item.assets.videos.length > 0) {
      item.statusMsg = `Optimizing ${item.assets.videos.length} base64 video(s)...`;
      item.progress = 15;
      updateCardProgress(item);

      const videoCache = new Map();

      for (let i = 0; i < item.assets.videos.length; i++) {
        const vAsset = item.assets.videos[i];
        const cacheKey = vAsset.b64.slice(0, 100) + '_' + vAsset.b64.length;

        if (state.deduplicateVideo && videoCache.has(cacheKey)) {
          const cached = videoCache.get(cacheKey);
          vAsset.compressedB64 = cached.b64;
          vAsset.compressedMime = cached.mime;
          vAsset.compressedSize = Math.round((cached.b64.length * 3) / 4);
        } else {
          item.statusMsg = `Transcoding video ${i + 1}/${item.assets.videos.length}...`;
          item.progress = 15 + Math.round(((i + 1) / item.assets.videos.length) * 45);
          updateCardProgress(item);

          try {
            const compRes = await transcodeBase64Video(vAsset.b64, vAsset.mime, {
              bitrateKbps: state.bitrateKbps,
              scale: state.scale,
              stripAudio: state.stripAudio
            });

            const compSize = Math.round((compRes.b64.length * 3) / 4);
            // Safety check: Only accept if smaller and non-trivial
            if (compSize < vAsset.size && compRes.b64.length > 100) {
              vAsset.compressedB64 = compRes.b64;
              vAsset.compressedMime = compRes.mime;
              vAsset.compressedSize = compSize;
              if (state.deduplicateVideo) videoCache.set(cacheKey, compRes);
            } else {
              vAsset.compressedB64 = vAsset.b64;
              vAsset.compressedMime = vAsset.mime;
              vAsset.compressedSize = vAsset.size;
              if (state.deduplicateVideo) videoCache.set(cacheKey, { b64: vAsset.b64, mime: vAsset.mime });
            }
          } catch (err) {
            vAsset.compressedB64 = vAsset.b64;
            vAsset.compressedMime = vAsset.mime;
            vAsset.compressedSize = vAsset.size;
          }
        }

        // Only substitute if actually compressed smaller
        if (vAsset.compressedB64 && vAsset.compressedSize < vAsset.size) {
          content = safeReplaceAll(content, vAsset.fullMatch, `data:video/${vAsset.compressedMime};base64,${vAsset.compressedB64}`);
        }
      }
    }

    // 2. Compress Images (safe: preserves native pixel dimensions & formats)
    if (state.compressImages && item.assets.images.length > 0) {
      item.statusMsg = `Optimizing ${item.assets.images.length} base64 image(s)...`;
      item.progress = 65;
      updateCardProgress(item);

      for (let i = 0; i < item.assets.images.length; i++) {
        const imgAsset = item.assets.images[i];
        try {
          const compImgRes = await compressBase64Image(imgAsset.b64, imgAsset.mime);
          const compSize = Math.round((compImgRes.b64.length * 3) / 4);
          if (compSize < imgAsset.size && compImgRes.b64.length > 100) {
            imgAsset.compressedB64 = compImgRes.b64;
            imgAsset.compressedSize = compSize;
            content = safeReplaceAll(content, imgAsset.fullMatch, `data:image/${compImgRes.mime};base64,${compImgRes.b64}`);
          }
        } catch (err) {}
      }
    }

    // 3. Minify Inline CSS (preserves calc() spacing, strings, url() and @keyframes)
    if (state.minifyCss) {
      item.statusMsg = 'Minifying inline CSS <style> blocks...';
      item.progress = 80;
      updateCardProgress(item);
      content = minifyInlineCss(content);
    }

    // 4. Minify Inline JS (safe tokenizer: protects base64, URLs, regexes, strings)
    if (state.minifyJs) {
      item.statusMsg = 'Minifying inline JavaScript <script> blocks...';
      item.progress = 88;
      updateCardProgress(item);
      content = minifyInlineJs(content);
    }

    // 5. Minify HTML Markup (safe: removes comments and blank lines, never breaks inline text)
    if (state.minifyHtml) {
      item.statusMsg = 'Minifying HTML markup and comments...';
      item.progress = 95;
      updateCardProgress(item);
      content = minifyHtmlMarkup(content);
    }

    item.compressedContent = content;
    item.compressedSize = new Blob([content]).size;
    item.progress = 100;
    item.status = 'completed';
    const reduction = ((1 - (item.compressedSize / item.originalSize)) * 100).toFixed(1);
    item.statusMsg = `Optimized! Reduced by ${reduction}%`;

    renderQueue();
  }

  function updateCardProgress(item) {
    const progWrap = document.getElementById(`prog_${item.id}`);
    if (!progWrap) return;
    progWrap.classList.add('active');
    const fill = progWrap.querySelector('.fc-progress-bar-fill');
    const msg = progWrap.querySelector('.status-msg');
    const pct = progWrap.querySelectorAll('.fc-progress-status span')[1];
    if (fill) fill.style.width = item.progress + '%';
    if (msg) msg.textContent = item.statusMsg;
    if (pct) pct.textContent = item.progress + '%';
  }

  // In-Browser Video Transcoder via MediaRecorder with Watchdog Timeout
  async function transcodeBase64Video(b64, mime, options) {
    return new Promise((resolve) => {
      let resolved = false;
      function done(res) {
        if (!resolved) {
          resolved = true;
          resolve(res);
        }
      }

      // Safety watchdog: prevent hanging queue if playback stalls
      const timer = setTimeout(() => {
        done({ b64: b64, mime: mime });
      }, 12000);

      try {
        const byteCharacters = atob(b64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: `video/${mime === 'mp4' ? 'mp4' : 'webm'}` });
        const videoUrl = URL.createObjectURL(blob);

        const video = document.createElement('video');
        video.src = videoUrl;
        video.muted = true; // Always muted offscreen to avoid browser autoplay blocks
        video.crossOrigin = 'anonymous';
        video.playsInline = true;
        video.preload = 'auto';

        video.onloadedmetadata = () => {
          const origW = video.videoWidth || 640;
          const origH = video.videoHeight || 360;
          const targetW = Math.round((origW * options.scale) / 2) * 2;
          const targetH = Math.round((origH * options.scale) / 2) * 2;

          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');

          let recMime = 'video/webm;codecs=vp9';
          let outContainer = 'webm';
          if (!MediaRecorder.isTypeSupported(recMime)) recMime = 'video/webm;codecs=vp8';
          if (!MediaRecorder.isTypeSupported(recMime)) recMime = 'video/webm';
          if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
            recMime = 'video/mp4;codecs=avc1';
            outContainer = 'mp4';
          } else if (MediaRecorder.isTypeSupported('video/mp4')) {
            recMime = 'video/mp4';
            outContainer = 'mp4';
          }

          const fps = 30;
          const stream = canvas.captureStream ? canvas.captureStream(fps) : null;
          if (!stream) {
            clearTimeout(timer);
            URL.revokeObjectURL(videoUrl);
            done({ b64: b64, mime: mime });
            return;
          }

          const recorderOptions = {
            mimeType: recMime,
            videoBitsPerSecond: options.bitrateKbps * 1000
          };

          let recorder;
          try {
            recorder = new MediaRecorder(stream, recorderOptions);
          } catch (e) {
            recorder = new MediaRecorder(stream);
          }

          const chunks = [];
          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunks.push(e.data);
          };

          recorder.onstop = () => {
            clearTimeout(timer);
            URL.revokeObjectURL(videoUrl);
            if (chunks.length === 0) {
              done({ b64: b64, mime: mime });
              return;
            }
            const outBlob = new Blob(chunks, { type: recMime });
            const reader = new FileReader();
            reader.onloadend = () => {
              const dataUrl = reader.result;
              const commaIdx = dataUrl.indexOf(',');
              const outB64 = commaIdx > -1 ? dataUrl.substring(commaIdx + 1) : dataUrl;
              done({ b64: outB64, mime: outContainer });
            };
            reader.readAsDataURL(outBlob);
          };

          let animId;
          function drawFrame() {
            if (video.paused || video.ended) return;
            ctx.drawImage(video, 0, 0, targetW, targetH);
            animId = requestAnimationFrame(drawFrame);
          }

          video.onended = () => {
            cancelAnimationFrame(animId);
            setTimeout(() => {
              if (recorder.state === 'recording') recorder.stop();
            }, 100);
          };

          video.onerror = () => {
            clearTimeout(timer);
            URL.revokeObjectURL(videoUrl);
            done({ b64: b64, mime: mime });
          };

          recorder.start(100);
          video.play().then(() => {
            drawFrame();
          }).catch(() => {
            clearTimeout(timer);
            URL.revokeObjectURL(videoUrl);
            done({ b64: b64, mime: mime });
          });
        };

        video.onerror = () => {
          clearTimeout(timer);
          URL.revokeObjectURL(videoUrl);
          done({ b64: b64, mime: mime });
        };
      } catch (e) {
        clearTimeout(timer);
        done({ b64: b64, mime: mime });
      }
    });
  }

  // Base64 Image Compression: Preserves native pixel dimensions & formats (no spritesheet distortion)
  async function compressBase64Image(b64, mime) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          // PRESERVE NATIVE DIMENSIONS: Do NOT resize or downscale!
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);

          // For JPEG, compress with quality 0.85; for PNG, keep as PNG without lossy artifacts
          const isPng = mime.toLowerCase().includes('png');
          const targetMime = isPng ? 'image/png' : 'image/jpeg';
          const quality = isPng ? 0.92 : 0.85;
          const dataUrl = canvas.toDataURL(targetMime, quality);
          const comma = dataUrl.indexOf(',');
          const outB64 = comma > -1 ? dataUrl.substring(comma + 1) : b64;
          resolve({ b64: outB64, mime: isPng ? 'png' : 'jpeg' });
        } catch (e) {
          resolve({ b64: b64, mime: mime });
        }
      };
      img.onerror = () => resolve({ b64: b64, mime: mime });
      img.src = `data:image/${mime};base64,${b64}`;
    });
  }

  // Safe HTML Minification Engine (removes redundant whitespace & comments, never smashes inline text)
  function minifyHtmlMarkup(html) {
    return html
      .replace(/<!--(?!\s*\[if[\s\S]+?\])(?!\s*mraid[\s\S]*?)[\s\S]*?-->/gi, '')
      .replace(/[\r\n]{2,}/g, '\n')
      .replace(/^[ \t]+/gm, '')
      .replace(/[ \t]+$/gm, '')
      .trim();
  }

  // Safe CSS Minification Engine (protects strings and url(), preserves calc() + and - spaces, keyframe 0%)
  function minifyInlineCss(html) {
    return html.replace(/<style([^>]*)>([\s\S]*?)<\/style>/gi, (match, attrs, css) => {
      let cleaned = '';
      let i = 0;
      const len = css.length;

      while (i < len) {
        const ch = css[i];
        const next = css[i + 1];

        // Remove CSS comment /* ... */
        if (ch === '/' && next === '*') {
          i += 2;
          while (i < len && !(css[i] === '*' && css[i + 1] === '/')) {
            i++;
          }
          i += 2;
          cleaned += ' ';
          continue;
        }

        // Preserve strings "..." and '...'
        if (ch === '"' || ch === "'") {
          const q = ch;
          cleaned += q;
          i++;
          while (i < len) {
            const c = css[i];
            cleaned += c;
            i++;
            if (c === '\\' && i < len) {
              cleaned += css[i];
              i++;
            } else if (c === q) {
              break;
            }
          }
          continue;
        }

        // Preserve url(...)
        if (css.slice(i, i + 4).toLowerCase() === 'url(') {
          cleaned += css.slice(i, i + 4);
          i += 4;
          while (i < len && css[i] !== ')') {
            cleaned += css[i];
            i++;
          }
          if (i < len && css[i] === ')') {
            cleaned += ')';
            i++;
          }
          continue;
        }

        cleaned += ch;
        i++;
      }

      const minCss = cleaned
        .replace(/\s+/g, ' ')
        .replace(/\s*([{};,])\s*/g, '$1')
        .replace(/;}/g, '}')
        .trim();

      return `<style${attrs}>${minCss}</style>`;
    });
  }

  // Safe JS Minification Engine (full character scanner: protects base64, URLs, regexes, strings, ASI)
  function safeMinifyJs(code) {
    let result = '';
    let i = 0;
    const len = code.length;

    while (i < len) {
      const ch = code[i];
      const next = code[i + 1];

      // 1. Single-line comment //
      if (ch === '/' && next === '/') {
        i += 2;
        while (i < len && code[i] !== '\n' && code[i] !== '\r') {
          i++;
        }
        result += '\n'; // Preserve newline for ASI
        continue;
      }

      // 2. Multi-line comment /* */
      if (ch === '/' && next === '*') {
        i += 2;
        let hasNewline = false;
        while (i < len && !(code[i] === '*' && code[i + 1] === '/')) {
          if (code[i] === '\n') hasNewline = true;
          i++;
        }
        i += 2; // skip */
        result += hasNewline ? '\n' : ' ';
        continue;
      }

      // 3. Single-quote string '...'
      if (ch === "'") {
        result += ch;
        i++;
        while (i < len) {
          const c = code[i];
          result += c;
          i++;
          if (c === '\\' && i < len) {
            result += code[i];
            i++;
          } else if (c === "'") {
            break;
          }
        }
        continue;
      }

      // 4. Double-quote string "..."
      if (ch === '"') {
        result += ch;
        i++;
        while (i < len) {
          const c = code[i];
          result += c;
          i++;
          if (c === '\\' && i < len) {
            result += code[i];
            i++;
          } else if (c === '"') {
            break;
          }
        }
        continue;
      }

      // 5. Template literal string `...`
      if (ch === '`') {
        result += ch;
        i++;
        while (i < len) {
          const c = code[i];
          result += c;
          i++;
          if (c === '\\' && i < len) {
            result += code[i];
            i++;
          } else if (c === '`') {
            break;
          }
        }
        continue;
      }

      // 6. Regex literal /.../
      if (ch === '/') {
        const prevNonWs = result.trimEnd().slice(-1);
        const isRegex = !prevNonWs || /[=([,:!?&|;{}~^+\-*\/]/.test(prevNonWs);
        if (isRegex) {
          result += ch;
          i++;
          let inCharClass = false;
          while (i < len) {
            const c = code[i];
            result += c;
            i++;
            if (c === '\\' && i < len) {
              result += code[i];
              i++;
            } else if (c === '[') {
              inCharClass = true;
            } else if (c === ']') {
              inCharClass = false;
            } else if (c === '/' && !inCharClass) {
              while (i < len && /[a-z]/i.test(code[i])) {
                result += code[i];
                i++;
              }
              break;
            }
          }
          continue;
        }
      }

      result += ch;
      i++;
    }

    return result
      .replace(/[ \t]+$/gm, '')
      .replace(/^[ \t]+/gm, '')
      .replace(/[\r\n]{2,}/g, '\n')
      .trim();
  }

  function minifyInlineJs(html) {
    return html.replace(/<script([^>]*)>([\s\S]*?)<\/script>/gi, (match, attrs, js) => {
      if (/src\s*=/i.test(attrs)) return match;
      const minJs = safeMinifyJs(js);
      return `<script${attrs}>${minJs}</script>`;
    });
  }

  // Single File Download
  function downloadSingleFile(item) {
    const content = item.compressedContent || item.rawContent;
    const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const extIndex = item.name.lastIndexOf('.');
    const base = extIndex > -1 ? item.name.substring(0, extIndex) : item.name;
    a.href = url;
    a.download = `${base}.compressed.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${a.download}`);
  }

  // Batch ZIP Download
  if (btnDownloadZipTop) btnDownloadZipTop.addEventListener('click', downloadAllAsZip);
  if (btnDownloadZipMain) btnDownloadZipMain.addEventListener('click', downloadAllAsZip);

  async function downloadAllAsZip() {
    if (state.files.length === 0) return;

    if (typeof JSZip === 'undefined') {
      showToast('JSZip library is still loading, please wait a moment...');
      return;
    }

    const zip = new JSZip();
    showToast('Building compressed creatives ZIP archive...');

    state.files.forEach(item => {
      const content = item.compressedContent || item.rawContent;
      const extIndex = item.name.lastIndexOf('.');
      const base = extIndex > -1 ? item.name.substring(0, extIndex) : item.name;
      zip.file(`${base}.compressed.html`, content);
    });

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compressed_html_builds_${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('ZIP archive downloaded successfully!');
  }

  // Live Sandbox Preview Modal & Orientation Logic
  let currentOrientation = 'portrait'; // 'portrait' | 'landscape'
  let currentBaseW = 375;
  let currentBaseH = 667;

  function updatePreviewDimensions() {
    if (!previewContainer) return;
    const isPortrait = currentOrientation === 'portrait';
    const minDim = Math.min(currentBaseW, currentBaseH);
    const maxDim = Math.max(currentBaseW, currentBaseH);

    const targetW = isPortrait ? minDim : maxDim;
    const targetH = isPortrait ? maxDim : minDim;

    previewContainer.style.width = targetW + 'px';
    previewContainer.style.height = targetH + 'px';

    const dimBadge = document.getElementById('previewDimBadge');
    if (dimBadge) {
      dimBadge.textContent = `${targetW} × ${targetH} px (${isPortrait ? 'Portrait' : 'Landscape'})`;
    }

    const btnPortrait = document.getElementById('btnOrientPortrait');
    const btnLandscape = document.getElementById('btnOrientLandscape');
    if (btnPortrait) btnPortrait.classList.toggle('active', isPortrait);
    if (btnLandscape) btnLandscape.classList.toggle('active', !isPortrait);
  }

  let activePreviewItem = null;

  function openPreviewModal(item) {
    activePreviewItem = item;

    // 1. Creative Build Name
    const prevInfoName = document.getElementById('prevInfoName');
    if (prevInfoName) prevInfoName.textContent = item.name;

    // 2. Video Quality (CRF, Bitrate, Resolution)
    const prevInfoVideoQuality = document.getElementById('prevInfoVideoQuality');
    if (prevInfoVideoQuality) {
      if (!state.transcodeVideo) {
        prevInfoVideoQuality.className = 'pss-badge badge-amber';
        prevInfoVideoQuality.textContent = '🎬 Untouched (Transcoding OFF)';
      } else {
        prevInfoVideoQuality.className = 'pss-badge badge-purple';
        let crfLabel = 'CRF ' + state.crf;
        if (state.crf === 24) crfLabel = 'CRF 24 (Near-Lossless)';
        else if (state.crf === 26) crfLabel = 'CRF 26 (Optimal)';
        else if (state.crf === 28) crfLabel = 'CRF 28 (Max Shrink)';

        prevInfoVideoQuality.textContent = `🎬 ${crfLabel} • ${state.bitrateKbps} kbps • ${Math.round(state.scale * 100)}% res${state.stripAudio ? ' • Muted' : ''}`;
      }
    }

    // 3. Target DSP Limit
    const prevInfoDspLimit = document.getElementById('prevInfoDspLimit');
    if (prevInfoDspLimit) {
      const isOver = item.compressedSize ? (item.compressedSize > (state.dspLimitMb * 1024 * 1024)) : (item.originalSize > (state.dspLimitMb * 1024 * 1024));
      prevInfoDspLimit.className = `pss-badge ${item.compressedSize ? (isOver ? 'badge-amber' : 'badge-green') : 'badge-blue'}`;
      prevInfoDspLimit.textContent = `🎯 Target ≤ ${state.dspLimitMb.toFixed(1)} MB`;
    }

    // 4. File Size Metrics
    const prevInfoSize = document.getElementById('prevInfoSize');
    if (prevInfoSize) {
      if (item.compressedSize) {
        const savingPct = ((1 - (item.compressedSize / item.originalSize)) * 100).toFixed(1);
        prevInfoSize.innerHTML = `${formatBytes(item.originalSize)} ➔ <strong style="color:var(--accent-green);">${formatBytes(item.compressedSize)}</strong> <span style="font-size:11px; color:var(--accent-green); font-weight:700;">(-${savingPct}%)</span>`;
      } else {
        prevInfoSize.textContent = `${formatBytes(item.originalSize)} (Uncompressed)`;
      }
    }

    // 5. Active Optimizations Tags
    const prevInfoTags = document.getElementById('prevInfoTags');
    if (prevInfoTags) {
      prevInfoTags.innerHTML = `
        <span class="pss-tag ${state.minifyHtml ? 'active' : ''}">HTML ${state.minifyHtml ? '✓' : 'off'}</span>
        <span class="pss-tag ${state.minifyCss ? 'active' : ''}">CSS ${state.minifyCss ? '✓' : 'off'}</span>
        <span class="pss-tag ${state.minifyJs ? 'active' : ''}">Safe JS ${state.minifyJs ? '✓' : 'off'}</span>
        <span class="pss-tag ${state.compressImages ? 'active' : ''}">Images ${state.compressImages ? '✓' : 'off'}</span>
        <span class="pss-tag ${state.transcodeVideo ? 'active' : ''}">Video ${state.transcodeVideo ? '✓' : 'off'}</span>
      `;
    }

    // 6. Version Toggle (Compressed vs Original)
    const btnPrevCompressed = document.getElementById('btnPrevCompressed');
    const btnPrevOriginal = document.getElementById('btnPrevOriginal');
    if (btnPrevCompressed && btnPrevOriginal) {
      if (item.compressedContent) {
        btnPrevCompressed.style.display = 'inline-block';
        btnPrevOriginal.style.display = 'inline-block';
        btnPrevCompressed.classList.add('active');
        btnPrevOriginal.classList.remove('active');
      } else {
        btnPrevCompressed.style.display = 'none';
        btnPrevOriginal.classList.add('active');
      }
    }

    const content = item.compressedContent || item.rawContent;
    if (previewIframe) previewIframe.srcdoc = content;
    updatePreviewDimensions();
    if (modalPreview) modalPreview.classList.add('active');
  }

  const btnPrevCompressed = document.getElementById('btnPrevCompressed');
  const btnPrevOriginal = document.getElementById('btnPrevOriginal');

  if (btnPrevCompressed) {
    btnPrevCompressed.addEventListener('click', () => {
      if (!activePreviewItem || !activePreviewItem.compressedContent) return;
      btnPrevCompressed.classList.add('active');
      if (btnPrevOriginal) btnPrevOriginal.classList.remove('active');
      if (previewIframe) previewIframe.srcdoc = activePreviewItem.compressedContent;
      showToast('Viewing Compressed Build');
    });
  }

  if (btnPrevOriginal) {
    btnPrevOriginal.addEventListener('click', () => {
      if (!activePreviewItem) return;
      btnPrevOriginal.classList.add('active');
      if (btnPrevCompressed) btnPrevCompressed.classList.remove('active');
      if (previewIframe) previewIframe.srcdoc = activePreviewItem.rawContent;
      showToast('Viewing Original Uncompressed Build');
    });
  }

  const btnOrientPortrait = document.getElementById('btnOrientPortrait');
  const btnOrientLandscape = document.getElementById('btnOrientLandscape');

  if (btnOrientPortrait) {
    btnOrientPortrait.addEventListener('click', () => {
      currentOrientation = 'portrait';
      updatePreviewDimensions();
    });
  }

  if (btnOrientLandscape) {
    btnOrientLandscape.addEventListener('click', () => {
      currentOrientation = 'landscape';
      updatePreviewDimensions();
    });
  }

  document.querySelectorAll('.device-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.device-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const w = parseInt(btn.getAttribute('data-w'), 10);
      const h = parseInt(btn.getAttribute('data-h'), 10);
      if (!isNaN(w) && !isNaN(h)) {
        currentBaseW = w;
        currentBaseH = h;
        updatePreviewDimensions();
      }
    });
  });

  // Asset Inspector Modal
  function openInspectModal(item) {
    if (!inspectBody) return;
    inspectBody.innerHTML = '';

    const overview = document.createElement('div');
    overview.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h4 style="font-size:15px; font-weight:700;">File: ${escapeHtml(item.name)}</h4>
        <span style="font-family:'JetBrains Mono'; font-size:12px; color:var(--text-secondary);">
          Original: ${formatBytes(item.originalSize)} &bull; Compressed: ${item.compressedSize ? formatBytes(item.compressedSize) : 'Pending'}
        </span>
      </div>
      <div style="height:10px; background:rgba(255,255,255,0.06); border-radius:6px; overflow:hidden; display:flex; margin-bottom:16px;">
        <div style="background:#b794f4; width:${Math.min(100, (item.assets.videos.reduce((a,v)=>a+v.size,0)/item.originalSize)*100)}%;" title="Videos"></div>
        <div style="background:#4fd1c5; width:${Math.min(100, (item.assets.images.reduce((a,v)=>a+v.size,0)/item.originalSize)*100)}%;" title="Images"></div>
        <div style="background:#63b3ed; width:${Math.min(100, (item.assets.jsChars/item.originalSize)*100)}%;" title="Scripts"></div>
      </div>
    `;
    inspectBody.appendChild(overview);

    if (item.assets.videos.length > 0) {
      const vHeader = document.createElement('h5');
      vHeader.style.cssText = 'font-size:13px; font-weight:700; color:var(--accent-purple); margin:12px 0 8px;';
      vHeader.textContent = `🎬 Embedded Base64 Videos (${item.assets.videos.length})`;
      inspectBody.appendChild(vHeader);

      item.assets.videos.forEach((vid, idx) => {
        const vidCard = document.createElement('div');
        vidCard.className = 'asset-item-card';
        const b64Src = vid.compressedB64 || vid.b64;
        vidCard.innerHTML = `
          <video class="asset-thumb-video" src="data:video/mp4;base64,${b64Src}" controls muted playsinline></video>
          <div class="asset-info">
            <strong>Video #${idx + 1} (${vid.mime.toUpperCase()})</strong>
            <div style="font-size:11.5px; color:var(--text-secondary); margin-top:3px;">
              Original: ${formatBytes(vid.size)} &bull; Compressed: ${vid.compressedSize ? formatBytes(vid.compressedSize) : 'Pending'}
            </div>
          </div>
          <button class="btn-fc btn-download-video" data-b64="${b64Src}">💾 Save MP4</button>
        `;
        inspectBody.appendChild(vidCard);
      });
    }

    if (item.assets.images.length > 0) {
      const iHeader = document.createElement('h5');
      iHeader.style.cssText = 'font-size:13px; font-weight:700; color:var(--accent-cyan); margin:16px 0 8px;';
      iHeader.textContent = `🖼️ High-Res Base64 Images (${item.assets.images.length})`;
      inspectBody.appendChild(iHeader);

      item.assets.images.slice(0, 6).forEach((img, idx) => {
        const imgCard = document.createElement('div');
        imgCard.className = 'asset-item-card';
        const b64Src = img.compressedB64 || img.b64;
        imgCard.innerHTML = `
          <img src="data:image/${img.mime};base64,${b64Src}" style="width:60px; height:60px; object-fit:contain; background:#000; border-radius:6px;" />
          <div class="asset-info">
            <strong>Image #${idx + 1} (${img.mime.toUpperCase()})</strong>
            <div style="font-size:11.5px; color:var(--text-secondary); margin-top:3px;">
              Original: ${formatBytes(img.size)} &bull; Compressed: ${img.compressedSize ? formatBytes(img.compressedSize) : 'Pending'}
            </div>
          </div>
        `;
        inspectBody.appendChild(imgCard);
      });
    }

    inspectBody.querySelectorAll('.btn-download-video').forEach(btn => {
      btn.addEventListener('click', () => {
        const b64 = btn.getAttribute('data-b64');
        const a = document.createElement('a');
        a.href = `data:video/mp4;base64,${b64}`;
        a.download = `extracted_video_${Date.now()}.mp4`;
        a.click();
      });
    });

    if (modalInspect) modalInspect.classList.add('active');
  }

  // Close modals
  document.querySelectorAll('.modal-close, .modal-backdrop').forEach(elem => {
    elem.addEventListener('click', (e) => {
      if (e.target === elem || elem.classList.contains('modal-close')) {
        if (modalPreview) modalPreview.classList.remove('active');
        if (modalInspect) modalInspect.classList.remove('active');
        if (previewIframe) previewIframe.srcdoc = '';
      }
    });
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (modalPreview) modalPreview.classList.remove('active');
      if (modalInspect) modalInspect.classList.remove('active');
    }
  });

  // Sample Creative Generator
  function generateAndLoadSampleAd() {
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 320;
    const ctx = canvas.getContext('2d');

    const grd = ctx.createLinearGradient(0, 0, 480, 320);
    grd.addColorStop(0, '#3182ce');
    grd.addColorStop(0.5, '#553c9a');
    grd.addColorStop(1, '#b794f4');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 480, 320);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Playable Ad Demo Video', 240, 160);

    const stream = canvas.captureStream(30);
    let recMime = 'video/webm';
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) recMime = 'video/webm;codecs=vp8';
    if (MediaRecorder.isTypeSupported('video/mp4')) recMime = 'video/mp4';

    const rec = new MediaRecorder(stream, { mimeType: recMime });
    const chunks = [];
    rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: recMime });
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result;
        const comma = dataUrl.indexOf(',');
        const b64Video = comma > -1 ? dataUrl.substring(comma + 1) : dataUrl;

        const actualSampleMime = recMime.includes('mp4') ? 'mp4' : 'webm';
        const sampleHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>Sample Playable Ad Creative</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #000000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      font-family: Arial, sans-serif;
      overflow: hidden;
    }
    .ad-container {
      width: 100%;
      max-width: 480px;
      position: relative;
      background: #111111;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 10px 40px rgba(0,0,0,0.8);
    }
    video {
      width: 100%;
      display: block;
    }
    .cta-banner {
      padding: 16px;
      text-align: center;
      background: linear-gradient(135deg, #1e3a8a, #3b82f6);
    }
    .cta-btn {
      padding: 12px 28px;
      background: #22c55e;
      color: #ffffff;
      font-weight: bold;
      border: none;
      border-radius: 24px;
      font-size: 16px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="ad-container">
    <video autoplay loop muted playsinline src="data:video/${actualSampleMime};base64,${b64Video}"></video>
    <div class="cta-banner">
      <h3 style="color:#ffffff; margin:0 0 10px;">PLAY NOW & WIN REWARDS!</h3>
      <button class="cta-btn" onclick="handleClick()">INSTALL FREE</button>
    </div>
  </div>
  <script>
    function handleClick() {
      if (window.mraid) {
        window.mraid.open("https://example.com/store");
      } else {
        window.open("https://example.com/store", "_blank");
      }
    }
  <\/script>
</body>
</html>`;

        const sampleFile = new File([sampleHtml], 'sample_playable_ad_build.html', { type: 'text/html' });
        const item = new FileItem('f_sample_' + Date.now(), sampleFile, sampleHtml);
        state.files.push(item);
        renderQueue();
        showToast('Sample playable ad with embedded base64 video loaded!');
      };
      reader.readAsDataURL(blob);
    };

    rec.start();
    let angle = 0;
    const animInt = setInterval(() => {
      angle += 0.15;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(240 + Math.cos(angle) * 80, 160 + Math.sin(angle) * 40, 18, 0, Math.PI * 2);
      ctx.fill();
    }, 33);

    setTimeout(() => {
      clearInterval(animInt);
      rec.stop();
    }, 1200);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function (m) {
      switch (m) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        case "'": return '&#39;';
        default: return m;
      }
    });
  }

})();
