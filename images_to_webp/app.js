(function () {
  'use strict';

  // DOM Elements
  var dropzone = document.getElementById('dropzone');
  var fileInput = document.getElementById('fileInput');
  var folderInput = document.getElementById('folderInput');
  var btnBrowseFiles = document.getElementById('btnBrowseFiles');
  var btnBrowseFolder = document.getElementById('btnBrowseFolder');

  var qualityRange = document.getElementById('qualityRange');
  var qualityValLabel = document.getElementById('qualityValLabel');
  var presetPills = document.getElementById('presetPills');
  var resizeMode = document.getElementById('resizeMode');
  var resizeInputsRow = document.getElementById('resizeInputsRow');
  var widthBox = document.getElementById('widthBox');
  var heightBox = document.getElementById('heightBox');
  var widthLabel = document.getElementById('widthLabel');
  var heightLabel = document.getElementById('heightLabel');
  var targetWidth = document.getElementById('targetWidth');
  var targetHeight = document.getElementById('targetHeight');

  var bgMode = document.getElementById('bgMode');
  var customColorBox = document.getElementById('customColorBox');
  var customBgColor = document.getElementById('customBgColor');
  var autoConvertChk = document.getElementById('autoConvertChk');
  var btnApplyAll = document.getElementById('btnApplyAll');

  var btnClearAll = document.getElementById('btnClearAll');
  var btnConvertAllTop = document.getElementById('btnConvertAllTop');
  var topCount = document.getElementById('topCount');
  var btnDownloadZipTop = document.getElementById('btnDownloadZipTop');
  var btnDownloadZipBottom = document.getElementById('btnDownloadZipBottom');
  var btnDownloadAllIndividual = document.getElementById('btnDownloadAllIndividual');

  var statsBar = document.getElementById('statsBar');
  var statCount = document.getElementById('statCount');
  var statConvertedSub = document.getElementById('statConvertedSub');
  var statOrigSize = document.getElementById('statOrigSize');
  var statWebpSize = document.getElementById('statWebpSize');
  var statSavedPct = document.getElementById('statSavedPct');
  var statSavedBytes = document.getElementById('statSavedBytes');

  var queueToolbar = document.getElementById('queueToolbar');
  var queueBadge = document.getElementById('queueBadge');
  var searchInput = document.getElementById('searchInput');
  var imageGrid = document.getElementById('imageGrid');

  var compareModal = document.getElementById('compareModal');
  var btnCloseModal = document.getElementById('btnCloseModal');
  var compareTitle = document.getElementById('compareTitle');
  var cmpOrigFmt = document.getElementById('cmpOrigFmt');
  var cmpOrigMeta = document.getElementById('cmpOrigMeta');
  var cmpOrigImg = document.getElementById('cmpOrigImg');
  var cmpWebpMeta = document.getElementById('cmpWebpMeta');
  var cmpWebpImg = document.getElementById('cmpWebpImg');

  var toastEl = document.getElementById('toast');
  var toastTimer = null;

  // State
  var items = [];
  var idCounter = 0;

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('show');
    }, 3200);
  }

  function fmtBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getFormatLabel(file) {
    if (file.type) {
      var sub = file.type.split('/')[1];
      if (sub) return sub.replace('svg+xml', 'svg').replace('jpeg', 'jpg').toUpperCase();
    }
    var m = /\.([a-z0-9]+)$/i.exec(file.name || '');
    return m ? m[1].toUpperCase() : 'IMG';
  }

  function getWebpFilename(origName) {
    var base = String(origName || 'image').replace(/\.[^.]+$/, '');
    return (base || 'image') + '.webp';
  }

  function isSupportedImageFile(file) {
    if (!file) return false;
    if (file.type && file.type.indexOf('image/') === 0) return true;
    return /\.(png|jpe?g|gif|bmp|svg|webp|avif|ico|tiff?)$/i.test(file.name || '');
  }

  // Global Settings Readers
  function getGlobalSettings() {
    var q = Math.max(1, Math.min(100, Number(qualityRange.value) || 82));
    var rMode = resizeMode.value;
    var w = Math.max(1, Number(targetWidth.value) || 1080);
    var h = Math.max(1, Number(targetHeight.value) || 1920);
    var bg = bgMode.value === 'custom' ? (customBgColor.value || '#000000') : bgMode.value;
    return {
      quality: q,
      resizeMode: rMode,
      targetWidth: w,
      targetHeight: h,
      bgFill: bg
    };
  }

  function computeOutputDimensions(origW, origH, settings) {
    var w = origW || 1;
    var h = origH || 1;
    if (settings.resizeMode === 'none') {
      return { width: w, height: h };
    }
    if (settings.resizeMode === 'scale') {
      var pct = Math.max(1, Math.min(1000, settings.targetWidth || 100)) / 100;
      return {
        width: Math.max(1, Math.round(w * pct)),
        height: Math.max(1, Math.round(h * pct))
      };
    }
    if (settings.resizeMode === 'exact') {
      return {
        width: Math.max(1, Math.round(settings.targetWidth || w)),
        height: Math.max(1, Math.round(settings.targetHeight || h))
      };
    }
    if (settings.resizeMode === 'max') {
      var maxW = settings.targetWidth || w;
      var maxH = settings.targetHeight || h;
      var ratio = Math.min(maxW / w, maxH / h, 1);
      return {
        width: Math.max(1, Math.round(w * ratio)),
        height: Math.max(1, Math.round(h * ratio))
      };
    }
    return { width: w, height: h };
  }

  // Load File into HTMLImageElement
  function loadImageElement(srcUrl) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('Failed to decode image')); };
      img.src = srcUrl;
    });
  }

  // Convert a single item to WebP
  async function convertItem(item, customQuality) {
    var settings = getGlobalSettings();
    var q = customQuality !== undefined ? customQuality : item.quality;
    item.quality = q;
    item.status = 'converting';

    try {
      if (!item.imgElement) {
        item.imgElement = await loadImageElement(item.origUrl);
      }
      var img = item.imgElement;
      item.origWidth = img.naturalWidth || img.width || 512;
      item.origHeight = img.naturalHeight || img.height || 512;

      var dims = computeOutputDimensions(item.origWidth, item.origHeight, settings);
      item.outWidth = dims.width;
      item.outHeight = dims.height;

      var canvas = document.createElement('canvas');
      canvas.width = dims.width;
      canvas.height = dims.height;
      var ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      if (settings.bgFill && settings.bgFill !== 'transparent') {
        ctx.fillStyle = settings.bgFill;
        ctx.fillRect(0, 0, dims.width, dims.height);
      } else {
        ctx.clearRect(0, 0, dims.width, dims.height);
      }

      ctx.drawImage(img, 0, 0, dims.width, dims.height);

      var blob = await new Promise(function (resolve, reject) {
        canvas.toBlob(function (b) {
          if (b) resolve(b);
          else reject(new Error('Browser WebP encoder returned empty blob'));
        }, 'image/webp', q / 100);
      });

      if (item.webpUrl) {
        URL.revokeObjectURL(item.webpUrl);
      }
      item.webpBlob = blob;
      item.webpSize = blob.size;
      item.webpUrl = URL.createObjectURL(blob);
      item.status = 'done';
      item.error = null;
    } catch (err) {
      item.status = 'error';
      item.error = err.message || 'Conversion failed';
    }

    updateCardDOM(item);
    updateStatsAndToolbar();
  }

  // Handle batch file import
  async function handleFiles(fileList) {
    var arr = Array.prototype.slice.call(fileList || []).filter(isSupportedImageFile);
    if (!arr.length) {
      showToast('⚠️ No supported image files found');
      return;
    }

    var globalQ = Number(qualityRange.value) || 82;
    var newItems = arr.map(function (file) {
      var id = 'img_' + (++idCounter);
      var origUrl = URL.createObjectURL(file);
      return {
        id: id,
        file: file,
        name: file.name || ('image_' + idCounter + '.png'),
        webpName: getWebpFilename(file.name || ('image_' + idCounter)),
        format: getFormatLabel(file),
        origSize: file.size,
        origUrl: origUrl,
        imgElement: null,
        origWidth: 0,
        origHeight: 0,
        outWidth: 0,
        outHeight: 0,
        quality: globalQ,
        webpBlob: null,
        webpSize: 0,
        webpUrl: null,
        status: 'pending',
        error: null
      };
    });

    items = items.concat(newItems);
    renderGrid();
    updateStatsAndToolbar();

    if (autoConvertChk.checked) {
      for (var i = 0; i < newItems.length; i++) {
        await convertItem(newItems[i], newItems[i].quality);
      }
      showToast('✅ Converted ' + newItems.length + ' image' + (newItems.length > 1 ? 's' : '') + ' to WebP');
    } else {
      showToast('📥 Imported ' + newItems.length + ' image' + (newItems.length > 1 ? 's' : '') + '. Click Convert All when ready.');
    }
  }

  async function convertAllItems(useGlobalQuality) {
    if (!items.length) return;
    var globalQ = Number(qualityRange.value) || 82;
    btnApplyAll.disabled = true;
    btnConvertAllTop.disabled = true;

    for (var i = 0; i < items.length; i++) {
      var q = useGlobalQuality ? globalQ : items[i].quality;
      await convertItem(items[i], q);
    }

    btnApplyAll.disabled = false;
    btnConvertAllTop.disabled = false;
    showToast('⚡ Batch converted ' + items.length + ' image' + (items.length > 1 ? 's' : '') + ' to WebP');
  }

  function updateStatsAndToolbar() {
    var hasItems = items.length > 0;
    statsBar.classList.toggle('visible', hasItems);
    queueToolbar.classList.toggle('visible', hasItems);
    btnClearAll.style.display = hasItems ? 'inline-flex' : 'none';
    btnConvertAllTop.style.display = hasItems ? 'inline-flex' : 'none';
    btnDownloadZipTop.style.display = hasItems ? 'inline-flex' : 'none';
    btnApplyAll.disabled = !hasItems;

    topCount.textContent = items.length;
    queueBadge.textContent = items.length;
    statCount.textContent = items.length;

    var doneCount = 0;
    var totalOrig = 0;
    var totalWebp = 0;

    items.forEach(function (it) {
      totalOrig += it.origSize || 0;
      if (it.status === 'done' && it.webpBlob) {
        doneCount++;
        totalWebp += it.webpSize || 0;
      }
    });

    statConvertedSub.textContent = doneCount + ' of ' + items.length + ' converted';
    statOrigSize.textContent = fmtBytes(totalOrig);
    statWebpSize.textContent = fmtBytes(totalWebp);

    if (doneCount > 0 && totalOrig > 0) {
      var diff = totalOrig - totalWebp;
      var pct = ((diff / totalOrig) * 100).toFixed(1);
      if (diff >= 0) {
        statSavedPct.textContent = '-' + pct + '%';
        statSavedPct.className = 'stat-val green';
        statSavedBytes.textContent = fmtBytes(diff) + ' saved';
      } else {
        statSavedPct.textContent = '+' + Math.abs(Number(pct)).toFixed(1) + '%';
        statSavedPct.className = 'stat-val cyan';
        statSavedBytes.textContent = fmtBytes(Math.abs(diff)) + ' larger';
      }
    } else {
      statSavedPct.textContent = '0%';
      statSavedBytes.textContent = '0 B saved';
    }

    btnDownloadZipTop.disabled = doneCount === 0;
    btnDownloadZipBottom.disabled = doneCount === 0;
    btnDownloadAllIndividual.disabled = doneCount === 0;
  }

  function buildCardInnerHTML(item) {
    var isDone = item.status === 'done' && item.webpBlob;
    var isErr = item.status === 'error';
    var savingsHtml = '';

    if (isDone && item.origSize > 0) {
      var diff = item.origSize - item.webpSize;
      var pct = ((diff / item.origSize) * 100).toFixed(1);
      var cls = diff >= 0 ? 'pos' : 'neg';
      var sign = diff >= 0 ? '-' : '+';
      savingsHtml = '<span class="badge-savings ' + cls + '">' + sign + Math.abs(Number(pct)).toFixed(1) + '%</span>';
    } else if (item.status === 'converting') {
      savingsHtml = '<span class="badge-savings pos">Converting…</span>';
    } else if (isErr) {
      savingsHtml = '<span class="badge-savings neg">Error</span>';
    }

    var dimOrig = item.origWidth ? (item.origWidth + '×' + item.origHeight) : '—';
    var dimOut = isDone && item.outWidth ? (item.outWidth + '×' + item.outHeight) : dimOrig;
    var previewSrc = isDone && item.webpUrl ? item.webpUrl : item.origUrl;

    return (
      '<div class="img-thumb-wrap" data-action="compare" data-id="' + item.id + '" title="Click to compare Original vs WebP">' +
        '<img class="img-thumb" src="' + previewSrc + '" alt="' + escHtml(item.name) + '" loading="lazy" />' +
        '<div class="thumb-badges">' +
          '<span class="badge-format">' + escHtml(item.format) + ' &rarr; <span>WEBP</span></span>' +
          savingsHtml +
        '</div>' +
        '<div class="thumb-compare-hint">🔍 Click to Compare</div>' +
      '</div>' +
      '<div class="img-body">' +
        '<div class="img-title-row">' +
          '<div class="img-name" title="' + escHtml(item.webpName) + '">' + escHtml(item.webpName) + '</div>' +
          '<button type="button" class="btn-remove-card" data-action="remove" data-id="' + item.id + '" title="Remove image">✕</button>' +
        '</div>' +
        '<div class="img-meta-grid">' +
          '<div class="meta-col">' +
            '<span class="meta-lbl">Original (' + escHtml(item.format) + ')</span>' +
            '<span class="meta-val">' + fmtBytes(item.origSize) + ' &bull; ' + dimOrig + '</span>' +
          '</div>' +
          '<div class="meta-col">' +
            '<span class="meta-lbl">WebP Output</span>' +
            '<span class="meta-val webp">' + (isDone ? (fmtBytes(item.webpSize) + ' &bull; ' + dimOut) : (isErr ? escHtml(item.error) : 'Pending…')) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="card-quality-row">' +
          '<span>Quality</span>' +
          '<input type="range" min="1" max="100" value="' + item.quality + '" data-action="card-quality" data-id="' + item.id + '" aria-label="Image quality" />' +
          '<span class="q-val" id="qval_' + item.id + '">' + item.quality + '%</span>' +
        '</div>' +
        '<div class="card-actions">' +
          '<button type="button" class="btn-card" data-action="compare" data-id="' + item.id + '" ' + (!isDone ? 'disabled' : '') + ' title="Compare Original vs WebP">🔍 Compare</button>' +
          '<button type="button" class="btn-card" data-action="b64" data-id="' + item.id + '" ' + (!isDone ? 'disabled' : '') + ' title="Copy data:image/webp;base64 URI">📋 Base64</button>' +
          '<button type="button" class="btn-card primary" data-action="download" data-id="' + item.id + '" ' + (!isDone ? 'disabled' : '') + ' title="Download .webp file">⬇ Save</button>' +
        '</div>' +
      '</div>'
    );
  }

  function updateCardDOM(item) {
    var cardEl = document.getElementById('card_' + item.id);
    if (!cardEl) return;
    cardEl.className = 'img-card' + (item.status === 'done' ? ' done' : '');
    cardEl.innerHTML = buildCardInnerHTML(item);
  }

  function renderGrid() {
    var query = (searchInput.value || '').trim().toLowerCase();
    imageGrid.innerHTML = '';

    items.forEach(function (item) {
      if (query && (item.name.toLowerCase().indexOf(query) === -1 && item.format.toLowerCase().indexOf(query) === -1)) {
        return;
      }
      var card = document.createElement('article');
      card.id = 'card_' + item.id;
      card.className = 'img-card' + (item.status === 'done' ? ' done' : '');
      card.innerHTML = buildCardInnerHTML(item);
      imageGrid.appendChild(card);
    });
  }

  function findItem(id) {
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === id) return items[i];
    }
    return null;
  }

  function removeItem(id) {
    var idx = -1;
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === id) { idx = i; break; }
    }
    if (idx === -1) return;
    var removed = items.splice(idx, 1)[0];
    if (removed.origUrl) URL.revokeObjectURL(removed.origUrl);
    if (removed.webpUrl) URL.revokeObjectURL(removed.webpUrl);
    renderGrid();
    updateStatsAndToolbar();
  }

  function downloadSingleItem(item) {
    if (!item || !item.webpBlob) return;
    var a = document.createElement('a');
    a.href = item.webpUrl || URL.createObjectURL(item.webpBlob);
    a.download = item.webpName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function copyBase64(item) {
    if (!item || !item.webpBlob) return;
    var reader = new FileReader();
    reader.onloadend = function () {
      var dataUrl = reader.result;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(dataUrl).then(function () {
          showToast('📋 Copied WebP Base64 Data URI (' + fmtBytes(dataUrl.length) + ')');
        }).catch(function () {
          showToast('⚠️ Clipboard write blocked by browser');
        });
      }
    };
    reader.readAsDataURL(item.webpBlob);
  }

  function openCompareModal(item) {
    if (!item) return;
    compareTitle.textContent = '🔍 ' + item.name + ' → ' + item.webpName;
    cmpOrigFmt.textContent = item.format;
    cmpOrigMeta.textContent = fmtBytes(item.origSize) + (item.origWidth ? ' • ' + item.origWidth + '×' + item.origHeight : '');
    cmpOrigImg.src = item.origUrl;

    if (item.webpBlob && item.webpUrl) {
      var diff = item.origSize - item.webpSize;
      var pct = item.origSize > 0 ? ((diff / item.origSize) * 100).toFixed(1) : '0.0';
      cmpWebpMeta.textContent = fmtBytes(item.webpSize) + ' • ' + item.outWidth + '×' + item.outHeight + ' (' + (diff >= 0 ? '-' : '+') + Math.abs(Number(pct)).toFixed(1) + '%)';
      cmpWebpImg.src = item.webpUrl;
    } else {
      cmpWebpMeta.textContent = 'Not converted yet';
      cmpWebpImg.src = item.origUrl;
    }
    compareModal.classList.add('open');
  }

  async function downloadBatchZip() {
    var ready = items.filter(function (it) { return it.status === 'done' && it.webpBlob; });
    if (!ready.length) {
      showToast('⚠️ No converted WebP images ready to export');
      return;
    }
    if (typeof JSZip === 'undefined') {
      showToast('⚠️ JSZip not loaded; downloading files individually…');
      ready.forEach(function (it, idx) {
        setTimeout(function () { downloadSingleItem(it); }, idx * 140);
      });
      return;
    }

    var zip = new JSZip();
    var usedNames = {};
    ready.forEach(function (it) {
      var name = it.webpName;
      if (usedNames[name]) {
        var base = name.replace(/\.webp$/i, '');
        name = base + '_' + (++usedNames[name]) + '.webp';
      } else {
        usedNames[name] = 1;
      }
      zip.file(name, it.webpBlob);
    });

    showToast('📦 Generating WebP archive…');
    var zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    var url = URL.createObjectURL(zipBlob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'webp_converted_' + ready.length + '_images.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 25000);
    showToast('✅ Downloaded ZIP with ' + ready.length + ' WebP image' + (ready.length > 1 ? 's' : ''));
  }

  // Event Listeners
  btnBrowseFiles.addEventListener('click', function (e) {
    e.stopPropagation();
    fileInput.click();
  });

  btnBrowseFolder.addEventListener('click', function (e) {
    e.stopPropagation();
    folderInput.click();
  });

  dropzone.addEventListener('click', function (e) {
    if (e.target.closest('button')) return;
    fileInput.click();
  });

  dropzone.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', function (e) {
    handleFiles(e.target.files);
    fileInput.value = '';
  });

  folderInput.addEventListener('change', function (e) {
    handleFiles(e.target.files);
    folderInput.value = '';
  });

  dropzone.addEventListener('dragover', function (e) {
    e.preventDefault();
    dropzone.classList.add('over');
  });

  dropzone.addEventListener('dragleave', function (e) {
    if (!dropzone.contains(e.relatedTarget)) {
      dropzone.classList.remove('over');
    }
  });

  dropzone.addEventListener('drop', function (e) {
    e.preventDefault();
    dropzone.classList.remove('over');
    if (e.dataTransfer && e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  });

  // Clipboard Paste Support
  window.addEventListener('paste', function (e) {
    if (!e.clipboardData || !e.clipboardData.files || !e.clipboardData.files.length) return;
    handleFiles(e.clipboardData.files);
  });

  // Quality & Presets
  qualityRange.addEventListener('input', function () {
    var q = Number(qualityRange.value);
    qualityValLabel.textContent = q + '%';
    Array.prototype.forEach.call(presetPills.querySelectorAll('.preset-pill'), function (btn) {
      btn.classList.toggle('active', Number(btn.dataset.q) === q);
    });
  });

  qualityRange.addEventListener('change', function () {
    if (autoConvertChk.checked && items.length) {
      convertAllItems(true);
    }
  });

  presetPills.addEventListener('click', function (e) {
    var btn = e.target.closest('.preset-pill');
    if (!btn) return;
    var q = Number(btn.dataset.q);
    qualityRange.value = q;
    qualityValLabel.textContent = q + '%';
    Array.prototype.forEach.call(presetPills.querySelectorAll('.preset-pill'), function (b) {
      b.classList.toggle('active', b === btn);
    });
    if (autoConvertChk.checked && items.length) {
      convertAllItems(true);
    }
  });

  resizeMode.addEventListener('change', function () {
    var m = resizeMode.value;
    if (m === 'none') {
      resizeInputsRow.style.display = 'none';
    } else if (m === 'scale') {
      resizeInputsRow.style.display = 'grid';
      widthBox.style.display = 'flex';
      heightBox.style.display = 'none';
      widthLabel.textContent = 'Scale Percentage (%)';
      targetWidth.value = '50';
    } else if (m === 'max') {
      resizeInputsRow.style.display = 'grid';
      widthBox.style.display = 'flex';
      heightBox.style.display = 'flex';
      widthLabel.textContent = 'Max Width (px)';
      heightLabel.textContent = 'Max Height (px)';
      if (Number(targetWidth.value) <= 100) targetWidth.value = '1080';
    } else if (m === 'exact') {
      resizeInputsRow.style.display = 'grid';
      widthBox.style.display = 'flex';
      heightBox.style.display = 'flex';
      widthLabel.textContent = 'Width (px)';
      heightLabel.textContent = 'Height (px)';
      if (Number(targetWidth.value) <= 100) targetWidth.value = '1080';
    }
    if (autoConvertChk.checked && items.length) {
      convertAllItems(false);
    }
  });

  targetWidth.addEventListener('change', function () {
    if (autoConvertChk.checked && items.length) convertAllItems(false);
  });

  targetHeight.addEventListener('change', function () {
    if (autoConvertChk.checked && items.length) convertAllItems(false);
  });

  bgMode.addEventListener('change', function () {
    customColorBox.style.display = bgMode.value === 'custom' ? 'flex' : 'none';
    if (autoConvertChk.checked && items.length) convertAllItems(false);
  });

  customBgColor.addEventListener('change', function () {
    if (autoConvertChk.checked && items.length) convertAllItems(false);
  });

  btnApplyAll.addEventListener('click', function () {
    convertAllItems(true);
  });

  btnConvertAllTop.addEventListener('click', function () {
    convertAllItems(true);
  });

  btnClearAll.addEventListener('click', function () {
    items.forEach(function (it) {
      if (it.origUrl) URL.revokeObjectURL(it.origUrl);
      if (it.webpUrl) URL.revokeObjectURL(it.webpUrl);
    });
    items = [];
    renderGrid();
    updateStatsAndToolbar();
    showToast('🗑️ Cleared image queue');
  });

  btnDownloadZipTop.addEventListener('click', downloadBatchZip);
  btnDownloadZipBottom.addEventListener('click', downloadBatchZip);

  btnDownloadAllIndividual.addEventListener('click', function () {
    var ready = items.filter(function (it) { return it.status === 'done' && it.webpBlob; });
    if (!ready.length) return;
    ready.forEach(function (it, idx) {
      setTimeout(function () { downloadSingleItem(it); }, idx * 140);
    });
    showToast('⬇ Downloading ' + ready.length + ' WebP file' + (ready.length > 1 ? 's' : '') + '…');
  });

  searchInput.addEventListener('input', renderGrid);

  // Delegated Card Actions
  imageGrid.addEventListener('click', function (e) {
    var actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    var action = actionEl.dataset.action;
    var id = actionEl.dataset.id;
    var item = findItem(id);
    if (!item) return;

    if (action === 'remove') {
      removeItem(id);
    } else if (action === 'download') {
      downloadSingleItem(item);
    } else if (action === 'b64') {
      copyBase64(item);
    } else if (action === 'compare') {
      openCompareModal(item);
    }
  });

  imageGrid.addEventListener('input', function (e) {
    var target = e.target;
    if (target.dataset.action === 'card-quality') {
      var qLabel = document.getElementById('qval_' + target.dataset.id);
      if (qLabel) qLabel.textContent = target.value + '%';
    }
  });

  imageGrid.addEventListener('change', function (e) {
    var target = e.target;
    if (target.dataset.action === 'card-quality') {
      var item = findItem(target.dataset.id);
      if (item) {
        convertItem(item, Number(target.value));
      }
    }
  });

  btnCloseModal.addEventListener('click', function () {
    compareModal.classList.remove('open');
  });

  compareModal.addEventListener('click', function (e) {
    if (e.target === compareModal) {
      compareModal.classList.remove('open');
    }
  });

  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && compareModal.classList.contains('open')) {
      compareModal.classList.remove('open');
    }
  });
})();

