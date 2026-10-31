/**
 * MRAID & UNIVERSAL HTML AD REPOSITION STUDIO - CORE APPLICATION LOGIC
 * Features: Direct Drag & Drop HTML Upload, Real-Time In-Canvas Clicking & Dragging,
 * Sidebar Precision X/Y Controls, Dynamic DOM Scanning & Positioning for MRAID,
 * SIP Video Creatives, and standard HTML5 Playable Ads.
 */

(function () {
  'use strict';

  // Inlined bridge bundle code for 100% offline and local file:// reliability
  const INLINED_BRIDGE_CODE = `
    (function() {
      if (window.__repositionBridgeLoaded) return;
      window.__repositionBridgeLoaded = true;

      const style = document.createElement('style');
      style.id = '__reposition_editor_styles';
      style.textContent = \`
        .repositionable-element, [data-reposition-key], .tb, .rb, #ctaBtn, .strip, [data-block-id],
        #sip-countdown, [id^="sip-dynamic-"], [id^="sip-custom-"], #sip-countup {
          pointer-events: auto !important;
          cursor: grab !important;
          user-select: none !important;
          -webkit-user-select: none !important;
          transition: outline 120ms ease, box-shadow 120ms ease;
        }
        .repositionable-element:hover, [data-reposition-key]:hover, .tb:hover, .rb:hover, #ctaBtn:hover, .strip:hover, [data-block-id]:hover,
        #sip-countdown:hover, [id^="sip-dynamic-"]:hover, [id^="sip-custom-"]:hover, #sip-countup:hover {
          outline: 2px dashed rgba(99, 102, 241, 0.9) !important;
          outline-offset: 3px !important;
        }
        .editor-selected-element {
          outline: 2.5px solid #6366f1 !important;
          outline-offset: 3px !important;
          box-shadow: 0 0 20px rgba(99, 102, 241, 0.75) !important;
          z-index: 9999 !important;
        }
        .editor-selected-element.is-dragging {
          cursor: grabbing !important;
          outline-color: #ec4899 !important;
          box-shadow: 0 0 25px rgba(236, 72, 153, 0.9) !important;
        }
        #editorSnapV {
          position: absolute; top: 0; bottom: 0; left: 50%; width: 1.5px;
          background: #06b6d4; box-shadow: 0 0 8px #06b6d4; pointer-events: none; z-index: 99998; display: none;
        }
        #editorSnapH {
          position: absolute; left: 0; right: 0; top: 50%; height: 1.5px;
          background: #ec4899; box-shadow: 0 0 8px #ec4899; pointer-events: none; z-index: 99998; display: none;
        }
      \`;
      document.head ? document.head.appendChild(style) : document.documentElement.appendChild(style);

      function isPortraitViewportNow() {
        return window.matchMedia ? !window.matchMedia("(orientation: landscape)").matches : window.innerHeight > window.innerWidth;
      }

      function setupGuides() {
        const container = document.getElementById('stage') || document.getElementById('video-container') || document.getElementById('overlay') || document.getElementById('root') || document.body;
        if (!container) return;
        let guideV = document.getElementById('editorSnapV');
        let guideH = document.getElementById('editorSnapH');
        if (!guideV) { guideV = document.createElement('div'); guideV.id = 'editorSnapV'; container.appendChild(guideV); }
        if (!guideH) { guideH = document.createElement('div'); guideH.id = 'editorSnapH'; container.appendChild(guideH); }
      }

      let activeElement = null;
      let isDragging = false;
      let dragStart = {};

      const mipRepositionTargets = [
        ['.intro-copy', 'intro-copy'],
        ['.intro-traits', 'intro-traits'],
        ['.intro-copy-description', 'intro-copy-description'],
        ['.tap-hand', 'tap-hand'],
        ['.intro-orange-overlay', 'intro-orange-overlay'],
        ['.prompt-row', 'prompt-row'],
        ['.chat-bubble--incoming', 'chat-bubble--incoming'],
        ['.profile-icon', 'profile-icon'],
        ['.answer-stack', 'answer-stack'],
        ['.answer-guide-hand', 'answer-guide-hand'],
        ['.outgoing-row', 'outgoing-row'],
        ['.chat-bubble--outgoing', 'chat-bubble--outgoing'],
        ['.reply-row--typing', 'reply-row--typing'],
        ['.reply-row:not(.reply-row--typing)', 'reply-row'],
        ['.endcard-card', 'endcard-card'],
        ['.endcard-logo', 'endcard-logo'],
        ['.endcard-title', 'endcard-title'],
        ['.endcard-subtitle', 'endcard-subtitle'],
        ['.endcard-desc', 'endcard-desc'],
        ['.endcard-cta-btn', 'endcard-cta-btn'],
        ['.endcard-mascot', 'endcard-mascot']
      ];

      function parsePercentVal(val, defaultVal = 50) {
        if (val === undefined || val === null || val === '') return defaultVal;
        const m = String(val).match(/([-\\d.]+)/);
        return m ? parseFloat(m[1]) : defaultVal;
      }

      function getElementKey(el) {
        if (!el) return '';
        return el.getAttribute('data-reposition-key') || el.id || el.getAttribute('data-block-id') || (el.className && typeof el.className === 'string' ? el.className.split(' ')[0] : 'element');
      }

      function findElementByKey(key) {
        if (!key) return null;
        return document.querySelector(\`[data-reposition-key="\${key}"]\`) || document.getElementById(key) || document.querySelector(\`[data-block-id="\${key}"]\`);
      }

      function getSipPositionObj(key) {
        if (window.__sipPositions && window.__sipPositions[key]) return window.__sipPositions[key];
        return null;
      }

      function isContainerElement(el) {
        if (!el) return true;
        const id = (el.id || '').toLowerCase();
        const tag = (el.tagName || '').toLowerCase();
        if (['html', 'head', 'body', 'script', 'style', 'link', 'meta'].includes(tag)) return true;
        if (['root', 'stage', 'overlay', 'bgblur', 'bg', 'video-container', 'sip-video'].includes(id)) return true;
        return false;
      }

      function findRepositionTarget(target) {
        if (!target || target === document.body || target === document.documentElement) return null;
        const ctaContainer = target.closest('#ctaBtn');
        if (ctaContainer) return ctaContainer;
        const closest = target.closest('[data-reposition-key], .repositionable-element, .tb, .rb, #ctaBtn, .strip, [data-block-id], #sip-countdown, [id^="sip-dynamic-"], [id^="sip-custom-"], #sip-countup');
        if (closest && !isContainerElement(closest)) return closest;

        let cur = target;
        while (cur && cur !== document.body && cur !== document.documentElement) {
          if (isContainerElement(cur)) { cur = cur.parentElement; continue; }
          if (cur.getAttribute('data-reposition-key') || cur.id || cur.getAttribute('data-block-id')) return cur;
          if (cur.style && (cur.style.left || cur.style.top || cur.style.position === 'absolute')) return cur;
          if (/^(h[1-6]|p|button|a|img|svg|span|div)$/i.test(cur.tagName) && cur.textContent.trim().length > 0) return cur;
          cur = cur.parentElement;
        }
        return null;
      }

      function tagRepositionableElements() {
        mipRepositionTargets.forEach(([selector, key]) => {
          document.querySelectorAll(selector).forEach(el => {
            el.setAttribute('data-reposition-key', key);
          });
        });

        const candidates = document.querySelectorAll('[data-block-id], [id], .tb, .rb, #ctaBtn, .strip, [id^="sip-"], h1, h2, h3, h4, h5, h6, p, button, a, img, svg, div');
        let autoIdx = 1;
        candidates.forEach(el => {
          if (isContainerElement(el)) return;
          if (el.id === 'editorSnapV' || el.id === 'editorSnapH') return;
          const hasContent = el.textContent && el.textContent.trim().length > 0;
          const hasIdentity = el.id || el.getAttribute('data-block-id') || (el.className && el.className.length > 0);
          const isPositioned = el.style && (el.style.left || el.style.top || el.style.position === 'absolute');

          if (hasIdentity || hasContent || isPositioned || ['IMG', 'BUTTON', 'A'].includes(el.tagName)) {
            el.classList.add('repositionable-element');
            if (!el.getAttribute('data-reposition-key')) {
              const key = el.id || el.getAttribute('data-block-id') || \`elem_\${autoIdx++}\`;
              el.setAttribute('data-reposition-key', key);
            }
          }
        });
      }

      function startElementDrag(el, e) {
        selectElement(el);
        isDragging = true;
        el.classList.add('is-dragging');
        try { el.setPointerCapture(e.pointerId); } catch (err) {}

        const key = getElementKey(el);
        const sipInfo = getSipPositionObj(key);

        if (sipInfo) {
          const isPortrait = isPortraitViewportNow();
          const orientation = isPortrait ? 'portrait' : 'landscape';
          const targetAnchor = isPortrait ? sipInfo.portrait : sipInfo.landscape;
          const video = document.getElementById('sip-video');
          const container = document.getElementById('video-container') || document.body;
          const boxW = container.clientWidth || window.innerWidth || 360;
          const boxH = container.clientHeight || window.innerHeight || 640;
          const iw = (video && video.videoWidth) ? video.videoWidth : (isPortrait ? 1080 : 1920);
          const ih = (video && video.videoHeight) ? video.videoHeight : (isPortrait ? 1920 : 1080);
          const scale = Math.max(boxW / iw, boxH / ih);

          dragStart = {
            isSip: true, pointerX: e.clientX, pointerY: e.clientY,
            startAnchorX: targetAnchor.x !== undefined ? targetAnchor.x : 0.5,
            startAnchorY: targetAnchor.y !== undefined ? targetAnchor.y : 0.2,
            iw, ih, scale, orientation, sipInfo, el
          };
        } else {
          const stage = document.getElementById('stage') || document.getElementById('video-container') || document.getElementById('root') || document.body;
          const stageRect = stage.getBoundingClientRect();
          const comp = window.getComputedStyle(el);
          if (comp.position === 'static') el.style.position = 'absolute';

          let curX = parsePercentVal(el.style.left, null);
          let curY = parsePercentVal(el.style.top, null);
          if (curX === null || curY === null) {
            const elRect = el.getBoundingClientRect();
            if (stageRect.width > 0) curX = ((elRect.left - stageRect.left) / stageRect.width) * 100;
            if (stageRect.height > 0) curY = ((elRect.top - stageRect.top) / stageRect.height) * 100;
          }

          dragStart = {
            isSip: false, pointerX: e.clientX, pointerY: e.clientY,
            elemX: curX !== null ? curX : 50,
            elemY: curY !== null ? curY : 50,
            stageW: stageRect.width || 360,
            stageH: stageRect.height || 640,
            el
          };
        }
      }

      function initPointerHandlers() {
        document.addEventListener('pointerdown', (e) => {
          const target = findRepositionTarget(e.target);
          if (!target) return;
          e.preventDefault();
          e.stopPropagation();
          startElementDrag(target, e);
        }, true);

        document.addEventListener('pointermove', (e) => {
          if (!isDragging || !activeElement || !dragStart.el) return;
          e.preventDefault();
          e.stopPropagation();

          const dx = e.clientX - dragStart.pointerX;
          const dy = e.clientY - dragStart.pointerY;
          const key = getElementKey(dragStart.el);

          if (dragStart.isSip) {
            const effectiveScale = dragStart.iw * dragStart.scale;
            const effectiveScaleY = dragStart.ih * dragStart.scale;
            let newAnchorX = dragStart.startAnchorX + (dx / effectiveScale);
            let newAnchorY = dragStart.startAnchorY + (dy / effectiveScaleY);

            if (e.shiftKey) {
              if (Math.abs(dx) > Math.abs(dy)) newAnchorY = dragStart.startAnchorY;
              else newAnchorX = dragStart.startAnchorX;
            }

            const guideV = document.getElementById('editorSnapV');
            if (Math.abs(newAnchorX - 0.5) < 0.015) {
              newAnchorX = 0.5;
              if (guideV) { guideV.style.left = '50%'; guideV.style.display = 'block'; }
            } else if (guideV) { guideV.style.display = 'none'; }

            newAnchorX = Math.max(0.01, Math.min(0.99, newAnchorX));
            newAnchorY = Math.max(0.01, Math.min(0.99, newAnchorY));

            const targetAnchor = dragStart.orientation === 'portrait' ? dragStart.sipInfo.portrait : dragStart.sipInfo.landscape;
            targetAnchor.x = newAnchorX;
            targetAnchor.y = newAnchorY;
            if (typeof dragStart.sipInfo.update === 'function') dragStart.sipInfo.update();

            window.parent.postMessage({
              type: 'ELEMENT_DRAGGING', key,
              x: parseFloat((newAnchorX * 100).toFixed(2)),
              y: parseFloat((newAnchorY * 100).toFixed(2)),
              anchorX: newAnchorX, anchorY: newAnchorY, isSip: true, orientation: dragStart.orientation
            }, '*');
          } else {
            let newX = dragStart.elemX + (dx / dragStart.stageW) * 100;
            let newY = dragStart.elemY + (dy / dragStart.stageH) * 100;

            if (e.shiftKey) {
              if (Math.abs(dx) > Math.abs(dy)) newY = dragStart.elemY;
              else newX = dragStart.elemX;
            }

            const guideV = document.getElementById('editorSnapV');
            if (Math.abs(newX - 50) < 1.4) {
              newX = 50;
              if (guideV) { guideV.style.left = '50%'; guideV.style.display = 'block'; }
            } else if (guideV) { guideV.style.display = 'none'; }

            dragStart.el.style.left = \`\${newX.toFixed(2)}%\`;
            dragStart.el.style.top = \`\${newY.toFixed(2)}%\`;

            window.parent.postMessage({
              type: 'ELEMENT_DRAGGING', key,
              x: parseFloat(newX.toFixed(2)), y: parseFloat(newY.toFixed(2)), isSip: false
            }, '*');
          }
        }, true);

        const onPointerEnd = (e) => {
          if (!isDragging) return;
          isDragging = false;
          if (dragStart.el) {
            dragStart.el.classList.remove('is-dragging');
            try { dragStart.el.releasePointerCapture(e.pointerId); } catch (err) {}
          }
          const guideV = document.getElementById('editorSnapV');
          const guideH = document.getElementById('editorSnapH');
          if (guideV) guideV.style.display = 'none';
          if (guideH) guideH.style.display = 'none';

          const key = getElementKey(dragStart.el || activeElement);
          if (dragStart.isSip) {
            const targetAnchor = dragStart.orientation === 'portrait' ? dragStart.sipInfo.portrait : dragStart.sipInfo.landscape;
            window.parent.postMessage({
              type: 'ELEMENT_DRAG_END', key,
              x: parseFloat((targetAnchor.x * 100).toFixed(2)),
              y: parseFloat((targetAnchor.y * 100).toFixed(2)),
              anchorX: targetAnchor.x, anchorY: targetAnchor.y, isSip: true, orientation: dragStart.orientation
            }, '*');
          } else if (dragStart.el) {
            const finalX = parsePercentVal(dragStart.el.style.left, 50);
            const finalY = parsePercentVal(dragStart.el.style.top, 50);
            window.parent.postMessage({ type: 'ELEMENT_DRAG_END', key, x: finalX, y: finalY, isSip: false }, '*');
          }
        };

        document.addEventListener('pointerup', onPointerEnd, true);
        document.addEventListener('pointercancel', onPointerEnd, true);

        document.addEventListener('click', (e) => {
          const target = findRepositionTarget(e.target);
          if (target) {
            e.preventDefault();
            e.stopPropagation();
          }
        }, true);
      }

      function selectElement(el) {
        if (!el) return;
        if (activeElement && activeElement !== el) activeElement.classList.remove('editor-selected-element');
        activeElement = el;
        el.classList.add('editor-selected-element');

        const key = getElementKey(el);
        const sipInfo = getSipPositionObj(key);

        if (sipInfo) {
          const isPortrait = isPortraitViewportNow();
          const orientation = isPortrait ? 'portrait' : 'landscape';
          const anchor = isPortrait ? sipInfo.portrait : sipInfo.landscape;
          window.parent.postMessage({
            type: 'ELEMENT_SELECTED', key,
            x: parseFloat(((anchor.x !== undefined ? anchor.x : 0.5) * 100).toFixed(2)),
            y: parseFloat(((anchor.y !== undefined ? anchor.y : 0.2) * 100).toFixed(2)),
            isSip: true, orientation, portraitAnchor: sipInfo.portrait, landscapeAnchor: sipInfo.landscape
          }, '*');
        } else {
          let x = parsePercentVal(el.style.left, null);
          let y = parsePercentVal(el.style.top, null);
          if (x === null || y === null) {
            const stage = document.getElementById('stage') || document.body;
            const stageRect = stage.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();
            if (stageRect.width > 0) x = parseFloat((((elRect.left - stageRect.left) / stageRect.width) * 100).toFixed(2));
            if (stageRect.height > 0) y = parseFloat((((elRect.top - stageRect.top) / stageRect.height) * 100).toFixed(2));
          }
          if (el.tagName === 'DIV' && parsePercentVal(el.style.left, null) === null) x = 50;
          window.parent.postMessage({ type: 'ELEMENT_SELECTED', key, x: x !== null ? x : 50, y: y !== null ? y : 50, isSip: false }, '*');
        }
      }

      window.addEventListener('message', (e) => {
        const data = e.data;
        if (!data || !data.type) return;

        if (data.type === 'SET_POSITION') {
          const sipInfo = getSipPositionObj(data.key);
          if (sipInfo) {
            const isPortrait = isPortraitViewportNow();
            const orientation = data.orientation || (isPortrait ? 'portrait' : 'landscape');
            const targetAnchor = orientation === 'portrait' ? sipInfo.portrait : sipInfo.landscape;
            if (data.x !== undefined) targetAnchor.x = parseFloat(data.x) / 100;
            if (data.y !== undefined) targetAnchor.y = parseFloat(data.y) / 100;
            if (typeof sipInfo.update === 'function') sipInfo.update();
          } else {
            const el = findElementByKey(data.key);
            if (el) {
              const comp = window.getComputedStyle(el);
              if (comp.position === 'static') el.style.position = 'absolute';
              if (data.x !== undefined) el.style.left = \`\${parseFloat(data.x).toFixed(2)}%\`;
              if (data.y !== undefined) el.style.top = \`\${parseFloat(data.y).toFixed(2)}%\`;
              if (data.transform !== undefined) el.style.transform = data.transform;
            }
          }
        } else if (data.type === 'SELECT_ELEMENT') {
          const el = findElementByKey(data.key);
          if (el) {
            selectElement(el);
            try { el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' }); } catch (err) {}
          }
        } else if (data.type === 'SET_STYLE') {
          const el = findElementByKey(data.key);
          if (el && data.property && data.value !== undefined) {
            el.style[data.property] = data.value;
          }
        }
      });

      setupGuides();
      tagRepositionableElements();
      const observer = new MutationObserver(() => tagRepositionableElements());
      observer.observe(document.documentElement, { childList: true, subtree: true });
      initPointerHandlers();
    })();
  `;

  // State
  const state = {
    filename: null,
    fileSize: 0,
    templateType: 'mraid', // 'mraid', 'sip', or 'mip'
    currentOrientation: 'portrait', // 'portrait' or 'landscape'
    currentScene: 'intro', // Active scene for MIP: 'intro' | 'question' | 'reaction' | 'endcard' | 'all'
    scenes: [],
    rawHtml: '',
    initialRawHtml: '',
    isServerMode: window.location.protocol.startsWith('http'),
    serverApiBase: window.location.protocol.startsWith('http') ? '' : 'http://localhost:3000',
    elements: [],
    layoutBlocksData: null,
    sipConfig: null,
    selectedKey: null,
    selectedElement: null,
    scale: 1.0,
    snapEnabled: true,
    gridEnabled: true,
    videoEnabled: true,
    history: [],
    historyIndex: -1,
    activeFilter: 'all',
    searchQuery: ''
  };

  // DOM Elements
  const DOM = {
    adFrame: document.getElementById('adFrame'),
    uploadPromptContainer: document.getElementById('uploadPromptContainer'),
    btnUploadPrompt: document.getElementById('btnUploadPrompt'),
    deviceBezel: document.getElementById('deviceBezel'),
    stageScreen: document.getElementById('stageScreen'),
    canvasScaler: document.getElementById('canvasScaler'),
    canvasViewport: document.getElementById('canvasViewport'),
    layersList: document.getElementById('layersList'),
    elementCountBadge: document.getElementById('elementCountBadge'),
    layerSearchInput: document.getElementById('layerSearchInput'),
    filterTabs: document.querySelectorAll('.filter-tab'),

    // Scene Selector Controls (MIP Multi-Scene)
    sceneSelectorWrapper: document.getElementById('sceneSelectorWrapper'),
    sceneDivider: document.getElementById('sceneDivider'),
    scenePillsContainer: document.getElementById('scenePillsContainer'),
    sidebarSceneBar: document.getElementById('sidebarSceneBar'),
    sidebarSceneSelect: document.getElementById('sidebarSceneSelect'),

    // Header Controls
    templateTag: document.getElementById('templateTag'),
    btnOpenFile: document.getElementById('btnOpenFile'),
    fileInput: document.getElementById('fileInput'),
    currentFileName: document.getElementById('currentFileName'),
    currentFileSize: document.getElementById('currentFileSize'),
    btnOrientationToggle: document.getElementById('btnOrientationToggle'),
    orientationLabel: document.getElementById('orientationLabel'),

    // Inspector
    insTypePill: document.getElementById('insTypePill'),
    insIdLabel: document.getElementById('insIdLabel'),
    insTextPreview: document.getElementById('insTextPreview'),
    sipOrientationTabs: document.getElementById('sipOrientationTabs'),
    tabOrientPortrait: document.getElementById('tabOrientPortrait'),
    tabOrientLandscape: document.getElementById('tabOrientLandscape'),
    inputXPercent: document.getElementById('inputXPercent'),
    inputYPercent: document.getElementById('inputYPercent'),
    sliderX: document.getElementById('sliderX'),
    sliderY: document.getElementById('sliderY'),
    xPixelIndicator: document.getElementById('xPixelIndicator'),
    yPixelIndicator: document.getElementById('yPixelIndicator'),
    inputWidth: document.getElementById('inputWidth'),
    inputHeight: document.getElementById('inputHeight'),
    anchorPoints: document.querySelectorAll('.anchor-point'),
    anchorLabel: document.getElementById('anchorLabel'),
    inputFontSize: document.getElementById('inputFontSize'),
    selectFontWeight: document.getElementById('selectFontWeight'),
    pickerColor: document.getElementById('pickerColor'),
    inputTextColor: document.getElementById('inputTextColor'),
    selectTextAlign: document.getElementById('selectTextAlign'),
    inputZIndex: document.getElementById('inputZIndex'),
    inputOpacity: document.getElementById('inputOpacity'),
    snippetCodePreview: document.getElementById('snippetCodePreview'),
    btnCopySnippet: document.getElementById('btnCopySnippet'),

    // Alignment buttons
    btnAlignLeft: document.getElementById('btnAlignLeft'),
    btnAlignCenterH: document.getElementById('btnAlignCenterH'),
    btnAlignRight: document.getElementById('btnAlignRight'),
    btnAlignTop: document.getElementById('btnAlignTop'),
    btnAlignCenterV: document.getElementById('btnAlignCenterV'),
    btnAlignBottom: document.getElementById('btnAlignBottom'),
    btnCenterBoth: document.getElementById('btnCenterBoth'),

    // Toolbar
    btnUndo: document.getElementById('btnUndo'),
    btnRedo: document.getElementById('btnRedo'),
    devicePresetSelect: document.getElementById('devicePresetSelect'),
    btnZoomIn: document.getElementById('btnZoomIn'),
    btnZoomOut: document.getElementById('btnZoomOut'),
    btnZoomReset: document.getElementById('btnZoomReset'),
    zoomLabel: document.getElementById('zoomLabel'),
    btnToggleSnap: document.getElementById('btnToggleSnap'),
    btnToggleGrid: document.getElementById('btnToggleGrid'),
    btnToggleVideo: document.getElementById('btnToggleVideo'),

    // Actions
    btnDiff: document.getElementById('btnDiff'),
    btnExport: document.getElementById('btnExport'),
    btnSaveFile: document.getElementById('btnSaveFile'),
    btnRescan: document.getElementById('btnRescan'),
    btnResetBackup: document.getElementById('btnResetBackup'),

    // HUD
    hudCoords: document.getElementById('hudCoords'),
    hudStageSize: document.getElementById('hudStageSize'),

    // Modals
    diffModal: document.getElementById('diffModal'),
    btnCloseDiff: document.getElementById('btnCloseDiff'),
    btnCancelDiff: document.getElementById('btnCancelDiff'),
    btnSaveFromDiff: document.getElementById('btnSaveFromDiff'),
    diffTableBody: document.getElementById('diffTableBody'),

    exportModal: document.getElementById('exportModal'),
    btnCloseExport: document.getElementById('btnCloseExport'),
    btnDownloadHtml: document.getElementById('btnDownloadHtml'),
    btnCopyHtml: document.getElementById('btnCopyHtml'),
    btnCopyJson: document.getElementById('btnCopyJson')
  };

  // Toast Notification
  function showToast(message, type = 'info') {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('visible'), 10);
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  function parsePercent(val, defaultVal = 50) {
    if (val === undefined || val === null || val === '') return defaultVal;
    if (typeof val === 'number') return val;
    const m = String(val).match(/([-\d.]+)/);
    return m ? parseFloat(m[1]) : defaultVal;
  }

  function formatPercent(num) {
    const value = typeof num === 'number' ? num : parsePercent(num, 50);
    return Number.isFinite(value) ? parseFloat(value.toFixed(2)) : 50;
  }

  // Universal Client-Side HTML Scanner
  function scanHtmlDocument(html, filename) {
    const isSip = html.includes('id="sip-builder-config"') || (filename && filename.includes('sample-2'));
    const isMip = html.includes('intro-scene-layer') ||
                  html.includes('chat-layer--question') ||
                  html.includes('endcard-layer') ||
                  html.includes('sample-mip') ||
                  (html.includes('.useState("intro")') && html.includes('endcard')) ||
                  (filename && filename.toLowerCase().includes('mip'));

    let templateType = isSip ? 'sip' : (isMip ? 'mip' : 'mraid');
    let elements = [];
    let layoutBlocks = null;
    let sipConfig = null;
    let scenes = [];

    if (isMip) {
      // 1. MIP Multi-Scene Playable Ad Parser (e.g. sample-mip.html)
      scenes = [
        {
          id: 'intro',
          name: '1. Intro Scene',
          icon: '👋',
          description: 'Hero greeting, character traits & tap-to-start',
          items: [
            { key: 'intro-copy', className: 'intro-copy', text: 'Intro Character Name & Greeting', category: 'text', scene: 'intro', left: '50%', top: '78%' },
            { key: 'intro-traits', className: 'intro-traits', text: 'Intro Traits Pill Tags', category: 'text', scene: 'intro', left: '50%', top: '72%' },
            { key: 'intro-copy-description', className: 'intro-copy-description', text: 'Character Story / Subtitle', category: 'text', scene: 'intro', left: '50%', top: '84%' },
            { key: 'tap-hand', className: 'tap-hand', text: 'Tap-to-Chat Animated Hand', category: 'button', scene: 'intro', left: '50%', top: '90%' },
            { key: 'intro-orange-overlay', className: 'intro-orange-overlay', text: 'Atmospheric Glow Overlay', category: 'rect', scene: 'intro', left: '0%', top: '0%' }
          ]
        },
        {
          id: 'question',
          name: '2. Question Scene',
          icon: '❓',
          description: 'Incoming chat question & choice buttons',
          items: [
            { key: 'prompt-row', className: 'prompt-row', text: 'Incoming Prompt Container', category: 'strip', scene: 'question', left: '50%', top: '65%' },
            { key: 'chat-bubble--incoming', className: 'chat-bubble chat-bubble--incoming', text: 'Incoming Question Chat Bubble', category: 'text', scene: 'question', left: '50%', top: '65%' },
            { key: 'profile-icon', className: 'profile-icon', text: 'Character Avatar Icon', category: 'image', scene: 'question', left: '16px', top: '65%' },
            { key: 'answer-stack', className: 'answer-stack', text: 'Choices Stack Container', category: 'button', scene: 'question', left: '50%', top: '80%' },
            { key: 'answer-guide-hand', className: 'answer-guide-hand', text: 'Answer Guide Indicator', category: 'image', scene: 'question', left: '50%', top: '85%' }
          ]
        },
        {
          id: 'reaction',
          name: '3. Reaction Scene',
          icon: '💬',
          description: 'Outgoing message & character reply',
          items: [
            { key: 'outgoing-row', className: 'outgoing-row', text: 'Outgoing Message Row', category: 'strip', scene: 'reaction', left: '50%', top: '55%' },
            { key: 'chat-bubble--outgoing', className: 'chat-bubble chat-bubble--outgoing', text: 'Player Reply Bubble', category: 'text', scene: 'reaction', left: '50%', top: '55%' },
            { key: 'reply-row--typing', className: 'reply-row reply-row--typing', text: 'Typing Dots Indicator', category: 'text', scene: 'reaction', left: '50%', top: '68%' },
            { key: 'reply-row', className: 'reply-row', text: 'Character Response Bubble', category: 'text', scene: 'reaction', left: '50%', top: '75%' }
          ]
        },
        {
          id: 'endcard',
          name: '4. End Card',
          icon: '🏆',
          description: 'Final app card, logo, title & CTA button',
          items: [
            { key: 'endcard-card', className: 'endcard-card', text: 'Endcard Card Container', category: 'rect', scene: 'endcard', left: '50%', top: '68%' },
            { key: 'endcard-logo', className: 'endcard-logo', text: 'App / Game Logo', category: 'image', scene: 'endcard', left: '50%', top: '58%' },
            { key: 'endcard-title', className: 'endcard-title', text: 'Endcard Headline Title', category: 'text', scene: 'endcard', left: '50%', top: '66%' },
            { key: 'endcard-subtitle', className: 'endcard-subtitle', text: 'Endcard Subtitle', category: 'text', scene: 'endcard', left: '50%', top: '72%' },
            { key: 'endcard-desc', className: 'endcard-desc', text: 'Endcard Description Copy', category: 'text', scene: 'endcard', left: '50%', top: '76%' },
            { key: 'endcard-cta-btn', className: 'endcard-cta-btn', text: 'Download CTA Button', category: 'button', scene: 'endcard', left: '50%', top: '84%' },
            { key: 'endcard-mascot', className: 'endcard-mascot', text: 'Mascot Character Illustration', category: 'image', scene: 'endcard', left: '50%', top: '35%' }
          ]
        }
      ];

      scenes.forEach(sc => {
        sc.items.forEach(item => {
          elements.push({
            key: item.key,
            id: item.key,
            blockId: null,
            tag: item.category === 'button' ? 'button' : (item.category === 'image' ? 'img' : 'div'),
            className: item.className,
            text: item.text,
            fullText: item.text,
            left: item.left,
            top: item.top,
            width: 'auto',
            height: 'auto',
            transform: item.left === '50%' ? 'translate(-50%, 0)' : 'none',
            category: item.category,
            scene: sc.id
          });
        });
      });
    } else if (isSip) {
      // 2. SIP Video JS Parser
      const configMatch = html.match(/id=["']sip-builder-config["'][^>]*>([\s\S]*?)<\/script>/i);
      if (configMatch) {
        try {
          sipConfig = JSON.parse(configMatch[1]);
          if (sipConfig.countdown && sipConfig.countdown.enabled !== false) {
            const pos = sipConfig.countdown.position || { portrait: { x: 0.5, y: 0.2266 }, landscape: { x: 0.7729, y: 0.5501 } };
            elements.push({
              key: 'sip-countdown',
              id: 'sip-countdown',
              blockId: 'countdown',
              tag: 'div',
              className: 'sip-countdown',
              text: '{hh} : {mm} : {ss}',
              fullText: 'Countdown Timer',
              isSip: true,
              position: pos,
              left: `${(pos.portrait.x * 100).toFixed(2)}%`,
              top: `${(pos.portrait.y * 100).toFixed(2)}%`,
              category: 'text'
            });
          }

          (sipConfig.dynamicTexts || []).forEach((d, idx) => {
            if (d.enabled !== false) {
              const pos = d.position || { portrait: { x: 0.5, y: 0.1976 + idx * 0.08 }, landscape: { x: 0.7731, y: 0.512 + idx * 0.1 } };
              const textVal = d.dateFormat?.customTokens || d.text || `Dynamic Text ${idx + 1}`;
              elements.push({
                key: `sip-dynamic-${d.id}`,
                id: `sip-dynamic-${d.id}`,
                blockId: d.id,
                tag: 'div',
                className: 'sip-dynamic-text',
                text: textVal,
                fullText: textVal,
                isSip: true,
                position: pos,
                left: `${(pos.portrait.x * 100).toFixed(2)}%`,
                top: `${(pos.portrait.y * 100).toFixed(2)}%`,
                category: 'text'
              });
            }
          });

          if (sipConfig.location && sipConfig.location.enabled) {
            const pos = sipConfig.location.position || { portrait: { x: 0.5, y: 0.85 }, landscape: { x: 0.5, y: 0.85 } };
            elements.push({
              key: 'sip-location',
              id: 'sip-location',
              blockId: 'location',
              tag: 'div',
              className: 'sip-location',
              text: sipConfig.location.sample || 'Location',
              fullText: sipConfig.location.sample || 'Location',
              isSip: true,
              position: pos,
              left: `${(pos.portrait.x * 100).toFixed(2)}%`,
              top: `${(pos.portrait.y * 100).toFixed(2)}%`,
              category: 'text'
            });
          }
        } catch(e) {
          console.error('[App] Failed to parse SIP builder config:', e);
        }
      }
    } else {
      // 3. Standard MRAID & Universal HTML Parser
      const lbMatch = html.match(/id=["'](?:__layout_blocks|layout-blocks)["'][^>]*>([\s\S]*?)<\/script>/i);
      if (lbMatch) {
        try {
          layoutBlocks = JSON.parse(lbMatch[1]);
        } catch(e) {}
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const ignoreIds = new Set(['root', 'stage', 'overlay', 'bgblur', 'bg', 'video-container', 'sip-video', 'devicebezel', 'stagescreen']);
      const seenKeys = new Set();

      const candidates = doc.querySelectorAll(
        '[data-block-id], [id], .tb, .rb, #ctaBtn, .strip, .btn, .cta, .button, ' +
        'h1, h2, h3, h4, h5, h6, p, button, a, img, svg, div'
      );

      let autoIdx = 1;
      candidates.forEach(el => {
        const id = (el.id || '').trim();
        const blockId = el.getAttribute('data-block-id') || '';
        const tag = el.tagName.toLowerCase();

        if (['html', 'head', 'body', 'script', 'style', 'link', 'meta'].includes(tag)) return;
        if (id && ignoreIds.has(id.toLowerCase())) return;

        const hasText = el.textContent && el.textContent.trim().length > 0;
        const inlineStyle = el.getAttribute('style') || '';
        const hasPosition = inlineStyle.includes('top:') || inlineStyle.includes('left:') || inlineStyle.includes('position:');
        const hasClasses = el.className && typeof el.className === 'string' && el.className.trim().length > 0;

        if (!id && !blockId && !hasPosition && !hasClasses && !['img', 'button', 'a'].includes(tag) && !hasText) {
          return;
        }

        let key = id || blockId;
        if (!key) {
          key = `elem_${autoIdx++}`;
        }

        if (seenKeys.has(key)) return;
        seenKeys.add(key);

        const styleObj = {};
        if (inlineStyle) {
          inlineStyle.split(';').forEach(rule => {
            const [p, v] = rule.split(':').map(s => s ? s.trim() : '');
            if (p && v) styleObj[p.toLowerCase()] = v;
          });
        }

        const layoutBlock = layoutBlocks && Array.isArray(layoutBlocks.blocks)
          ? layoutBlocks.blocks.find(b => b.id === blockId || b.id === id)
          : null;

        const cleanText = el.textContent ? el.textContent.replace(/\s+/g, ' ').trim() : '';

        let left = styleObj['left'] || (layoutBlock ? `${layoutBlock.x}%` : '50%');
        let top = styleObj['top'] || (layoutBlock ? `${layoutBlock.y}%` : '50%');

        let category = 'text';
        if (tag === 'img' || tag === 'svg' || el.classList.contains('image')) category = 'image';
        else if (tag === 'button' || tag === 'a' || id.toLowerCase().includes('cta') || id.toLowerCase().includes('btn') || el.classList.contains('btn') || el.classList.contains('cta')) category = 'button';
        else if (id.toLowerCase().includes('strip') || el.classList.contains('strip')) category = 'strip';
        else if (id.toLowerCase().includes('bg') || el.classList.contains('rb') || (layoutBlock && layoutBlock.type === 'rect')) category = 'rect';

        elements.push({
          key,
          id: id || null,
          blockId: blockId || null,
          tag,
          className: el.className || '',
          text: cleanText.slice(0, 80) || `<${tag}> element`,
          fullText: cleanText,
          hasLayoutBlock: !!layoutBlock,
          layoutBlock,
          left,
          top,
          width: styleObj['width'] || (layoutBlock ? `${layoutBlock.width}%` : 'auto'),
          height: styleObj['height'] || (layoutBlock && layoutBlock.height ? `${layoutBlock.height}%` : 'auto'),
          transform: styleObj['transform'] || (left === '50%' ? 'translate(-50%, 0)' : 'none'),
          fontSize: styleObj['font-size'] || (layoutBlock ? `${layoutBlock.fontSize}cqmin` : ''),
          color: styleObj['color'] || (layoutBlock ? layoutBlock.color : ''),
          fontWeight: styleObj['font-weight'] || (layoutBlock ? String(layoutBlock.fontWeight) : ''),
          textAlign: styleObj['text-align'] || (layoutBlock ? layoutBlock.align : 'center'),
          zIndex: styleObj['z-index'] || '',
          opacity: styleObj['opacity'] || (layoutBlock && layoutBlock.opacity !== undefined ? String(layoutBlock.opacity) : '1'),
          category,
          scene: 'global'
        });
      });
    }

    return {
      filename,
      fileSize: html.length,
      templateType,
      elements,
      layoutBlocks,
      sipConfig,
      scenes,
      rawHtml: html
    };
  }

  // Inject Editor Bridge (styles & script) directly into the HTML string before rendering in iframe
  function injectBridgeIntoHtml(html) {
    if (!html) return '';

    // If bridge styles already injected, return as is
    if (html.includes('id="__reposition_editor_styles"')) return html;

    const bridgeInjection = `
      <script src="bridge.js?${Date.now()}"></script>
      <script id="__reposition_bridge_script">
        if (!window.__repositionBridgeLoaded) {
          ${INLINED_BRIDGE_CODE}
        }
      </script>
    `;

    if (/<\/body>/i.test(html)) {
      return html.replace(/<\/body>/i, `${bridgeInjection}\n</body>`);
    } else if (/<\/html>/i.test(html)) {
      return html.replace(/<\/html>/i, `${bridgeInjection}\n</html>`);
    } else {
      return html + bridgeInjection;
    }
  }

  // Load Ad HTML into Preview Iframe
  function loadAdInIframe(htmlContent) {
    let processedHtml = htmlContent;
    if (processedHtml.includes('.useState("intro")') || processedHtml.includes('function es(){')) {
      const mipRegex = /((?:const|let|var)\s+[^;]*?\[([a-zA-Z0-9_$]+),\s*([a-zA-Z0-9_$]+)\]\s*=\s*[a-zA-Z0-9_$]+\.useState\(["']intro["']\)[^;]*;)/g;
      processedHtml = processedHtml.replace(mipRegex, '$1 window.__setCreativeScene = $3; window.__internalSetScene = $3; window.__currentScene = $2;');
    }
    const injectedHtml = injectBridgeIntoHtml(processedHtml);

    // Using srcdoc ensures instant, same-origin synchronous loading without blob URL relative script errors
    DOM.adFrame.srcdoc = injectedHtml;
    console.log(`[App] Loaded ad into iframe via srcdoc (${injectedHtml.length} bytes)`);
  }

  // Apply scanned element data
  function applyScanData(data) {
    state.filename = data.filename || 'ad.html';
    state.fileSize = data.fileSize || 0;
    state.templateType = data.templateType || 'mraid';
    state.layoutBlocksData = data.layoutBlocks || null;
    state.sipConfig = data.sipConfig || null;
    state.scenes = data.scenes || [];

    if (data.rawHtml) {
      state.rawHtml = data.rawHtml;
    }

    // Update Header Status
    DOM.currentFileName.textContent = state.filename;
    DOM.currentFileSize.textContent = `${(state.fileSize / 1024 / 1024).toFixed(2)} MB`;
    DOM.currentFileSize.style.display = 'inline-block';
    DOM.templateTag.style.display = 'inline-block';

    if (state.templateType === 'sip') {
      DOM.templateTag.textContent = 'SIP (JS)';
      DOM.templateTag.classList.add('sip-mode');
      DOM.templateTag.classList.remove('tag-mip-mode');
      DOM.sipOrientationTabs.style.display = 'block';
      if (DOM.sceneSelectorWrapper) DOM.sceneSelectorWrapper.style.display = 'none';
      if (DOM.sceneDivider) DOM.sceneDivider.style.display = 'none';
      if (DOM.sidebarSceneBar) DOM.sidebarSceneBar.style.display = 'none';
      updateSipOrientationTabs();
    } else if (state.templateType === 'mip') {
      DOM.templateTag.textContent = 'MIP Multi-Scene';
      DOM.templateTag.classList.add('tag-mip-mode');
      DOM.templateTag.classList.remove('sip-mode');
      DOM.sipOrientationTabs.style.display = 'none';
      if (DOM.sceneSelectorWrapper) DOM.sceneSelectorWrapper.style.display = 'inline-flex';
      if (DOM.sceneDivider) DOM.sceneDivider.style.display = 'block';
      if (DOM.sidebarSceneBar) DOM.sidebarSceneBar.style.display = 'flex';
      state.currentScene = 'intro';
      updateScenePills();
      if (DOM.sidebarSceneSelect) DOM.sidebarSceneSelect.value = 'intro';
    } else {
      DOM.templateTag.textContent = state.layoutBlocksData ? 'MRAID' : 'HTML5';
      DOM.templateTag.classList.remove('sip-mode');
      DOM.templateTag.classList.remove('tag-mip-mode');
      DOM.sipOrientationTabs.style.display = 'none';
      if (DOM.sceneSelectorWrapper) DOM.sceneSelectorWrapper.style.display = 'none';
      if (DOM.sceneDivider) DOM.sceneDivider.style.display = 'none';
      if (DOM.sidebarSceneBar) DOM.sidebarSceneBar.style.display = 'none';
    }

    const blocksMap = new Map();
    if (state.layoutBlocksData && Array.isArray(state.layoutBlocksData.blocks)) {
      state.layoutBlocksData.blocks.forEach(b => blocksMap.set(b.id, b));
    }

    state.elements = (data.elements || []).map(el => {
      let x = parsePercent(el.left, 50);
      let y = parsePercent(el.top, 50);

      if (el.isSip || state.templateType === 'sip') {
        const pos = el.position || {
          portrait: { x: parsePercent(el.left, 50) / 100, y: parsePercent(el.top, 50) / 100 },
          landscape: { x: 0.77, y: 0.55 }
        };
        const curAnchor = state.currentOrientation === 'portrait' ? pos.portrait : pos.landscape;
        x = (curAnchor.x !== undefined ? curAnchor.x : 0.5) * 100;
        y = (curAnchor.y !== undefined ? curAnchor.y : 0.2) * 100;

        return {
          ...el,
          isSip: true,
          position: pos,
          originalX: x,
          originalY: y,
          x: x,
          y: y,
          width: el.width || 'auto',
          height: el.height || 'auto',
          transform: el.transform || 'none',
          visible: true,
          locked: false
        };
      }

      const layoutBlock = el.blockId ? blocksMap.get(el.blockId) : (el.id ? blocksMap.get(el.id) : null);

      return {
        ...el,
        scene: el.scene || 'global',
        layoutBlock: layoutBlock || el.layoutBlock,
        originalX: x,
        originalY: y,
        x: x,
        y: y,
        width: el.width || 'auto',
        height: el.height || 'auto',
        transform: el.transform || (x === 50 ? 'translate(-50%, 0)' : 'none'),
        visible: true,
        locked: false
      };
    });

    renderLayersList();
    DOM.elementCountBadge.textContent = state.elements.length;

    if (state.elements.length > 0) {
      selectElement(state.elements[0].key);
    }

    recordHistory('Initial load');
  }

  // File Selection Handler
  async function handleFileSelected(file) {
    if (!file) return;

    try {
      showToast(`Loading ${file.name}...`, 'info');
      let content = '';
      if (typeof file.text === 'function') {
        content = await file.text();
      } else {
        content = await new Promise((res, rej) => {
          const reader = new FileReader();
          reader.onload = e => res(e.target.result);
          reader.onerror = rej;
          reader.readAsText(file);
        });
      }

      if (!content || content.length < 50) {
        showToast('Selected file is empty or invalid HTML.', 'error');
        return;
      }

      state.initialRawHtml = content;
      state.rawHtml = content;
      state.filename = file.name;
      state.fileSize = file.size;

      // 1. Scan actual elements from the uploaded HTML!
      const scanData = scanHtmlDocument(content, file.name);
      applyScanData(scanData);

      // 2. Hide upload dropzone, show preview iframe
      if (DOM.uploadPromptContainer) DOM.uploadPromptContainer.style.display = 'none';
      if (DOM.adFrame) {
        DOM.adFrame.style.display = 'block';
        loadAdInIframe(content);
      }

      // 3. Enable toolbar buttons
      if (DOM.btnSaveFile) DOM.btnSaveFile.disabled = false;
      if (DOM.btnDiff) DOM.btnDiff.disabled = false;
      if (DOM.btnExport) DOM.btnExport.disabled = false;

      // 4. If server is active, upload to server working directory
      if (state.isServerMode) {
        try {
          fetch(`${state.serverApiBase}/api/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, html: content })
          }).catch(() => {});
        } catch(e) {}
      }

      showToast(`Loaded ${file.name} (${scanData.elements.length} elements detected)!`, 'success');
    } catch (err) {
      console.error('File load error:', err);
      showToast('Error reading file: ' + err.message, 'error');
    }
  }

  // Switch Active Orientation (Portrait / Landscape)
  function setOrientation(newOrient) {
    state.currentOrientation = newOrient;
    const isPortrait = newOrient === 'portrait';

    DOM.orientationLabel.textContent = isPortrait ? 'Portrait' : 'Landscape';
    DOM.btnOrientationToggle.classList.toggle('active', !isPortrait);

    if (isPortrait) {
      DOM.deviceBezel.style.width = '360px';
      DOM.deviceBezel.style.height = '640px';
      DOM.devicePresetSelect.value = '9:16';
    } else {
      DOM.deviceBezel.style.width = '640px';
      DOM.deviceBezel.style.height = '360px';
      DOM.devicePresetSelect.value = 'landscape';
    }

    updateSipOrientationTabs();

    if (state.templateType === 'sip') {
      state.elements.forEach(el => {
        if (el.position && el.position[newOrient]) {
          const anchor = el.position[newOrient];
          el.x = (anchor.x !== undefined ? anchor.x : 0.5) * 100;
          el.y = (anchor.y !== undefined ? anchor.y : 0.2) * 100;
        }
      });
      if (state.selectedElement) {
        populateInspector(state.selectedElement);
      }
      renderLayersList();
    }

    sendToIframe('SET_ORIENTATION', { orientation: newOrient });
  }

  function updateSipOrientationTabs() {
    const isPortrait = state.currentOrientation === 'portrait';
    DOM.tabOrientPortrait.classList.toggle('active', isPortrait);
    DOM.tabOrientLandscape.classList.toggle('active', !isPortrait);
  }

  // Post message to iframe
  function sendToIframe(type, payload = {}) {
    try {
      if (DOM.adFrame && DOM.adFrame.contentWindow) {
        DOM.adFrame.contentWindow.postMessage({ type, ...payload }, '*');
      }
    } catch (e) {}
  }

  // Listen to messages from the in-frame bridge
  window.addEventListener('message', (e) => {
    const data = e.data;
    if (!data || !data.type) return;

    if (data.type === 'ELEMENT_SELECTED') {
      const el = state.elements.find(item => item.key === data.key || item.id === data.key || item.blockId === data.key);
      if (el) {
        const x = Number(data.x);
        const y = Number(data.y);
        if (Number.isFinite(x)) {
          if (el.x === el.originalX) el.originalX = x;
          el.x = x;
        }
        if (Number.isFinite(y)) {
          if (el.y === el.originalY) el.originalY = y;
          el.y = y;
        }
      }
      selectElement(data.key, false);
    } else if (data.type === 'ELEMENT_DRAGGING') {
      handleElementMovedFromIframe(data.key, data.x, data.y, data.isSip, data.orientation);
    } else if (data.type === 'ELEMENT_DRAG_END') {
      handleElementMovedFromIframe(data.key, data.x, data.y, data.isSip, data.orientation);
      recordHistory(`Drag ${data.key}`);
    } else if (data.type === 'SCENE_ELEMENTS_SCANNED') {
      handleSceneElementsScanned(data.scene, data.elements);
    }
  });

  // Switch Scene for MIP Multi-Scene Creatives
  function switchScene(sceneId) {
    state.currentScene = sceneId;
    updateScenePills();
    if (DOM.sidebarSceneSelect) DOM.sidebarSceneSelect.value = sceneId;

    sendToIframe('SET_SCENE', { scene: sceneId });
    renderLayersList();

    const sceneNames = {
      intro: '1. Intro Scene (👋)',
      question: '2. Question Scene (❓)',
      reaction: '3. Reaction Scene (💬)',
      endcard: '4. End Card (🏆)',
      all: 'All Scenes (🌐)'
    };
    showToast(`Active Scene: ${sceneNames[sceneId] || sceneId}`, 'info');

    // Select first element of active scene
    const firstInScene = state.elements.find(el => el.scene === sceneId);
    if (firstInScene) {
      selectElement(firstInScene.key, true);
    }
  }

  function updateScenePills() {
    if (!DOM.scenePillsContainer) return;
    const pills = DOM.scenePillsContainer.querySelectorAll('.scene-pill');
    pills.forEach(pill => {
      pill.classList.toggle('active', pill.dataset.scene === state.currentScene);
    });
  }

  function handleSceneElementsScanned(scene, scannedElements) {
    if (!Array.isArray(scannedElements)) return;
    scannedElements.forEach(item => {
      let existing = state.elements.find(el => el.key === item.key || el.id === item.key || el.className === item.className);
      if (existing) {
        if (item.x !== undefined && item.y !== undefined) {
          if (existing.x === 50 && existing.y === 50 && (item.x !== 50 || item.y !== 50)) {
            existing.x = item.x;
            existing.y = item.y;
            existing.originalX = item.x;
            existing.originalY = item.y;
          }
        }
        if (item.text && (!existing.text || existing.text.length < item.text.length)) {
          existing.text = item.text;
          existing.fullText = item.text;
        }
      } else {
        state.elements.push({
          key: item.key,
          id: item.id || item.key,
          blockId: null,
          tag: item.tag || 'div',
          className: item.className || '',
          text: item.text || item.key,
          fullText: item.text || item.key,
          left: `${item.x}%`,
          top: `${item.y}%`,
          x: item.x,
          y: item.y,
          originalX: item.x,
          originalY: item.y,
          width: 'auto',
          height: 'auto',
          transform: 'none',
          category: 'text',
          scene: scene || 'global',
          visible: true,
          locked: false
        });
      }
    });
    renderLayersList();
    DOM.elementCountBadge.textContent = state.elements.length;
  }

  // Handle position update originating from direct in-canvas dragging
  function handleElementMovedFromIframe(key, x, y, isSip, orientation) {
    let el = state.elements.find(item => item.key === key || item.id === key || item.blockId === key);

    // If not found in pre-scanned list, add it dynamically
    if (!el) {
      el = {
        key,
        id: key,
        blockId: null,
        tag: 'div',
        className: '',
        text: key,
        fullText: key,
        left: `${x}%`,
        top: `${y}%`,
        x,
        y,
        width: 'auto',
        height: 'auto',
        transform: 'none',
        category: 'text',
        scene: state.currentScene || 'global'
      };
      state.elements.push(el);
      renderLayersList();
    }

    el.x = x;
    el.y = y;

    if (el.isSip || isSip) {
      const orient = orientation || state.currentOrientation;
      if (!el.position) el.position = { portrait: {}, landscape: {} };
      if (!el.position[orient]) el.position[orient] = {};
      el.position[orient].x = x / 100;
      el.position[orient].y = y / 100;
    }

    if (el.layoutBlock) {
      el.layoutBlock.x = x;
      el.layoutBlock.y = y;
    }

    if (state.selectedKey === el.key) {
      DOM.inputXPercent.value = formatPercent(x);
      DOM.inputYPercent.value = formatPercent(y);
      DOM.sliderX.value = x;
      DOM.sliderY.value = y;

      const stageW = state.currentOrientation === 'portrait' ? 360 : 640;
      const stageH = state.currentOrientation === 'portrait' ? 640 : 360;
      DOM.xPixelIndicator.textContent = `${Math.round((x / 100) * stageW)} px`;
      DOM.yPixelIndicator.textContent = `${Math.round((y / 100) * stageH)} px`;

      updateSnippetPreview(el);
    }

    DOM.hudCoords.textContent = `X: ${formatPercent(x)}%  Y: ${formatPercent(y)}%`;
  }

  // Render Layers List in Left Sidebar
  function renderLayersList() {
    DOM.layersList.innerHTML = '';

    if (!state.filename) {
      DOM.layersList.innerHTML = '<div class="empty-layers">Upload an HTML file to detect and edit layers.</div>';
      return;
    }

    let filtered = state.elements;

    // Filter by Active Scene in MIP mode
    if (state.templateType === 'mip' && state.currentScene && state.currentScene !== 'all') {
      filtered = filtered.filter(el => !el.scene || el.scene === state.currentScene || el.scene === 'global');
    }

    if (state.activeFilter !== 'all') {
      filtered = filtered.filter(el => {
        const cat = getElementCategory(el);
        return cat === state.activeFilter;
      });
    }

    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      filtered = filtered.filter(el =>
        (el.key && el.key.toLowerCase().includes(q)) ||
        (el.id && el.id.toLowerCase().includes(q)) ||
        (el.blockId && el.blockId.toLowerCase().includes(q)) ||
        (el.text && el.text.toLowerCase().includes(q)) ||
        (el.tag && el.tag.toLowerCase().includes(q)) ||
        (el.scene && el.scene.toLowerCase().includes(q))
      );
    }

    if (filtered.length === 0) {
      DOM.layersList.innerHTML = '<div class="empty-layers">No matching elements found for this scene/filter</div>';
      return;
    }

    filtered.forEach(el => {
      const item = document.createElement('div');
      item.className = 'layer-item';
      if (el.key === state.selectedKey) item.classList.add('selected');
      if (el.locked) item.classList.add('locked');
      item.dataset.key = el.key;

      const cat = getElementCategory(el);
      const icon = getCategoryIcon(cat);

      item.innerHTML = `
        <div class="layer-drag-handle">⋮⋮</div>
        <div class="layer-icon type-${cat}">${icon}</div>
        <div class="layer-info">
          <div class="layer-id">
            ${escapeHtml(el.blockId || el.id || el.key)}
            ${el.scene && el.scene !== 'global' ? `<span class="layer-scene-badge">${el.scene}</span>` : ''}
          </div>
          <div class="layer-preview">${escapeHtml(el.text || `<${el.tag}>`)}</div>
        </div>
        <div class="layer-actions">
          <button class="layer-action-btn" data-action="lock" title="${el.locked ? 'Unlock Element' : 'Lock Element'}">
            ${el.locked ? '🔒' : '🔓'}
          </button>
        </div>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.closest('.layer-action-btn')) return;
        selectElement(el.key);
      });

      const lockBtn = item.querySelector('[data-action="lock"]');
      lockBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        el.locked = !el.locked;
        renderLayersList();
        showToast(`${el.blockId || el.id || el.key} ${el.locked ? 'Locked' : 'Unlocked'}`);
      });

      DOM.layersList.appendChild(item);
    });
  }

  // Select an Element
  function selectElement(key, notifyIframe = true) {
    const el = state.elements.find(x => x.key === key || x.id === key || x.blockId === key);
    if (!el) return;

    state.selectedKey = el.key;
    state.selectedElement = el;

    document.querySelectorAll('.layer-item').forEach(item => {
      item.classList.toggle('selected', item.dataset.key === el.key);
    });

    populateInspector(el);

    if (notifyIframe) {
      sendToIframe('SELECT_ELEMENT', { key: el.key });
    }

    const layerItem = document.querySelector(`.layer-item[data-key="${el.key}"]`);
    if (layerItem) layerItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function populateInspector(el) {
    const cat = getElementCategory(el);
    DOM.insTypePill.textContent = el.isSip ? `SIP ${cat.toUpperCase()}` : cat.toUpperCase();
    DOM.insIdLabel.textContent = el.blockId || el.id || el.key;
    DOM.insTextPreview.textContent = el.text ? `"${el.text}"` : `<${el.tag}> element`;

    DOM.inputXPercent.value = formatPercent(el.x);
    DOM.inputYPercent.value = formatPercent(el.y);
    DOM.sliderX.value = el.x;
    DOM.sliderY.value = el.y;

    const stageW = state.currentOrientation === 'portrait' ? 360 : 640;
    const stageH = state.currentOrientation === 'portrait' ? 640 : 360;
    const pxX = Math.round((el.x / 100) * stageW);
    const pxY = Math.round((el.y / 100) * stageH);
    DOM.xPixelIndicator.textContent = `${pxX} px`;
    DOM.yPixelIndicator.textContent = `${pxY} px`;

    DOM.inputWidth.value = el.width || 'auto';
    DOM.inputHeight.value = el.height || 'auto';

    highlightAnchorPoint(el.transform);

    DOM.inputFontSize.value = el.fontSize || '';
    DOM.selectFontWeight.value = el.fontWeight || '400';
    DOM.inputTextColor.value = el.color || '#ffffff';
    if (el.color && el.color.startsWith('#')) {
      DOM.pickerColor.value = el.color.length === 7 ? el.color : '#ffffff';
    }
    DOM.selectTextAlign.value = el.textAlign || 'center';
    DOM.inputZIndex.value = el.zIndex || '';
    DOM.inputOpacity.value = el.opacity || '1';

    updateSnippetPreview(el);
  }

  function highlightAnchorPoint(trans) {
    let matchedOrigin = '50% 0';
    if (trans) {
      if (trans.includes('-50%, -50%')) matchedOrigin = '50% 50%';
      else if (trans.includes('-50%, 0')) matchedOrigin = '50% 0';
      else if (trans.includes('0, 0') || trans === 'none') matchedOrigin = '0 0';
      else if (trans.includes('-50%, -100%')) matchedOrigin = '50% 100%';
    }

    DOM.anchorPoints.forEach(pt => {
      const isMatch = pt.dataset.origin === matchedOrigin;
      pt.classList.toggle('active', isMatch);
      if (isMatch) DOM.anchorLabel.textContent = pt.getAttribute('title');
    });
  }

  function updateSnippetPreview(el) {
    if (el.isSip || state.templateType === 'sip') {
      const isPort = state.currentOrientation === 'portrait';
      const suffix = isPort ? 'Portrait' : 'Landscape';
      const varPrefix = el.id.includes('countdown') ? 'countdownPosition' : 'datePosition';
      const normX = (el.x / 100).toFixed(4);
      const normY = (el.y / 100).toFixed(4);

      DOM.snippetCodePreview.textContent = `// Coordinate for ${suffix}\n${varPrefix}${suffix}.x = ${normX};\n${varPrefix}${suffix}.y = ${normY};`;
    } else {
      DOM.snippetCodePreview.textContent = `#${el.id || el.blockId} {\n  left: ${formatPercent(el.x)}%;\n  top: ${formatPercent(el.y)}%;\n  transform: ${el.transform || 'translate(-50%, 0)'};\n}`;
    }
  }

  function getElementCategory(el) {
    if (el.category) return el.category;
    const key = (el.key || el.id || '').toLowerCase();
    if (key.includes('strip')) return 'strip';
    if (key.includes('cta') || key.includes('btn') || el.tag === 'button' || el.tag === 'a') return 'button';
    if (key.includes('disclaimer_bg') || el.className?.includes('rb') || (el.layoutBlock && el.layoutBlock.type === 'rect')) return 'rect';
    if (el.tag === 'img' || el.tag === 'svg') return 'image';
    return 'text';
  }

  function getCategoryIcon(cat) {
    switch (cat) {
      case 'button': return '🔘';
      case 'strip': return '🎗️';
      case 'rect': return '⬜';
      case 'image': return '🖼️';
      case 'text':
      default: return 'T';
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Precision Position Controls in Inspector
  function updateSelectedElementPosition(newX, newY, recordHist = true) {
    if (!state.selectedElement || state.selectedElement.locked) return;
    const el = state.selectedElement;

    if (newX !== null && newX !== undefined) {
      newX = Math.max(0, Math.min(100, parseFloat(newX)));
      el.x = newX;
      DOM.inputXPercent.value = formatPercent(newX);
      DOM.sliderX.value = newX;
    }

    if (newY !== null && newY !== undefined) {
      newY = Math.max(0, Math.min(100, parseFloat(newY)));
      el.y = newY;
      DOM.inputYPercent.value = formatPercent(newY);
      DOM.sliderY.value = newY;
    }

    const stageW = state.currentOrientation === 'portrait' ? 360 : 640;
    const stageH = state.currentOrientation === 'portrait' ? 640 : 360;
    DOM.xPixelIndicator.textContent = `${Math.round((el.x / 100) * stageW)} px`;
    DOM.yPixelIndicator.textContent = `${Math.round((el.y / 100) * stageH)} px`;

    if (el.isSip || state.templateType === 'sip') {
      const orient = state.currentOrientation;
      if (!el.position) el.position = { portrait: {}, landscape: {} };
      if (!el.position[orient]) el.position[orient] = {};
      el.position[orient].x = el.x / 100;
      el.position[orient].y = el.y / 100;
    }

    if (el.layoutBlock) {
      el.layoutBlock.x = el.x;
      el.layoutBlock.y = el.y;
    }

    sendToIframe('SET_POSITION', {
      key: el.key,
      x: el.x,
      y: el.y,
      transform: el.transform,
      orientation: state.currentOrientation
    });

    updateSnippetPreview(el);
    DOM.hudCoords.textContent = `X: ${formatPercent(el.x)}%  Y: ${formatPercent(el.y)}%`;

    if (recordHist) recordHistory(`Move ${el.key}`);
  }

  // Setup Event Listeners for Inspector Inputs
  function initInputListeners() {
    DOM.inputXPercent.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val)) updateSelectedElementPosition(val, null, false);
    });
    DOM.inputXPercent.addEventListener('change', () => recordHistory('Change X input'));

    DOM.inputYPercent.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val)) updateSelectedElementPosition(null, val, false);
    });
    DOM.inputYPercent.addEventListener('change', () => recordHistory('Change Y input'));

    DOM.sliderX.addEventListener('input', (e) => {
      updateSelectedElementPosition(parseFloat(e.target.value), null, false);
    });
    DOM.sliderX.addEventListener('change', () => recordHistory('Change X slider'));

    DOM.sliderY.addEventListener('input', (e) => {
      updateSelectedElementPosition(null, parseFloat(e.target.value), false);
    });
    DOM.sliderY.addEventListener('change', () => recordHistory('Change Y slider'));

    // Step Buttons
    document.querySelectorAll('.step-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!state.selectedElement || state.selectedElement.locked) return;
        const target = btn.dataset.target;
        const step = parseFloat(btn.dataset.step);

        if (target === 'x') {
          updateSelectedElementPosition(state.selectedElement.x + step, null);
        } else if (target === 'y') {
          updateSelectedElementPosition(null, state.selectedElement.y + step);
        }
      });
    });

    // Alignment Buttons
    DOM.btnAlignLeft.addEventListener('click', () => updateSelectedElementPosition(0, null));
    DOM.btnAlignCenterH.addEventListener('click', () => updateSelectedElementPosition(50, null));
    DOM.btnAlignRight.addEventListener('click', () => updateSelectedElementPosition(100, null));
    DOM.btnAlignTop.addEventListener('click', () => updateSelectedElementPosition(null, 0));
    DOM.btnAlignCenterV.addEventListener('click', () => updateSelectedElementPosition(null, 50));
    DOM.btnAlignBottom.addEventListener('click', () => updateSelectedElementPosition(null, 100));
    DOM.btnCenterBoth.addEventListener('click', () => updateSelectedElementPosition(50, 50));

    // Anchor points
    DOM.anchorPoints.forEach(pt => {
      pt.addEventListener('click', () => {
        if (!state.selectedElement || state.selectedElement.locked) return;
        const origin = pt.dataset.origin;
        let trans = 'translate(-50%, 0)';
        if (origin === '50% 50%') trans = 'translate(-50%, -50%)';
        else if (origin === '0 0') trans = 'none';
        else if (origin === '50% 100%') trans = 'translate(-50%, -100%)';

        state.selectedElement.transform = trans;
        highlightAnchorPoint(trans);
        sendToIframe('SET_POSITION', { key: state.selectedElement.key, transform: trans });
        updateSnippetPreview(state.selectedElement);
        recordHistory('Change Anchor');
      });
    });

    // Font size, color, weight, text-align
    DOM.inputFontSize.addEventListener('input', (e) => {
      if (!state.selectedElement) return;
      state.selectedElement.fontSize = e.target.value;
      sendToIframe('SET_STYLE', { key: state.selectedElement.key, property: 'fontSize', value: e.target.value });
    });

    DOM.selectFontWeight.addEventListener('change', (e) => {
      if (!state.selectedElement) return;
      state.selectedElement.fontWeight = e.target.value;
      sendToIframe('SET_STYLE', { key: state.selectedElement.key, property: 'fontWeight', value: e.target.value });
    });

    DOM.pickerColor.addEventListener('input', (e) => {
      if (!state.selectedElement) return;
      state.selectedElement.color = e.target.value;
      DOM.inputTextColor.value = e.target.value;
      sendToIframe('SET_STYLE', { key: state.selectedElement.key, property: 'color', value: e.target.value });
    });

    DOM.inputTextColor.addEventListener('input', (e) => {
      if (!state.selectedElement) return;
      state.selectedElement.color = e.target.value;
      if (e.target.value.startsWith('#') && e.target.value.length === 7) {
        DOM.pickerColor.value = e.target.value;
      }
      sendToIframe('SET_STYLE', { key: state.selectedElement.key, property: 'color', value: e.target.value });
    });

    DOM.selectTextAlign.addEventListener('change', (e) => {
      if (!state.selectedElement) return;
      state.selectedElement.textAlign = e.target.value;
      sendToIframe('SET_STYLE', { key: state.selectedElement.key, property: 'textAlign', value: e.target.value });
    });

    DOM.inputZIndex.addEventListener('input', (e) => {
      if (!state.selectedElement) return;
      state.selectedElement.zIndex = e.target.value;
      sendToIframe('SET_STYLE', { key: state.selectedElement.key, property: 'zIndex', value: e.target.value });
    });

    DOM.inputOpacity.addEventListener('input', (e) => {
      if (!state.selectedElement) return;
      state.selectedElement.opacity = e.target.value;
      sendToIframe('SET_STYLE', { key: state.selectedElement.key, property: 'opacity', value: e.target.value });
    });
  }

  // Toolbar & Zoom Controls
  function initToolbarControls() {
    DOM.btnUndo.addEventListener('click', undo);
    DOM.btnRedo.addEventListener('click', redo);

    DOM.devicePresetSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      const bezel = DOM.deviceBezel;

      switch (val) {
        case 'iphone15':
          bezel.style.width = '393px'; bezel.style.height = '852px'; break;
        case 'pixel8':
          bezel.style.width = '412px'; bezel.style.height = '892px'; break;
        case 'compact':
          bezel.style.width = '320px'; bezel.style.height = '568px'; break;
        case 'ipad':
          bezel.style.width = '540px'; bezel.style.height = '720px'; break;
        case 'landscape':
          bezel.style.width = '640px'; bezel.style.height = '360px';
          setOrientation('landscape'); break;
        case 'responsive':
          bezel.style.width = '100%'; bezel.style.height = '100%'; break;
        case '9:16':
        default:
          bezel.style.width = '360px'; bezel.style.height = '640px';
          setOrientation('portrait'); break;
      }

      DOM.hudStageSize.textContent = `${bezel.offsetWidth} × ${bezel.offsetHeight}`;
    });

    DOM.btnZoomIn.addEventListener('click', () => setZoom(state.scale + 0.1));
    DOM.btnZoomOut.addEventListener('click', () => setZoom(state.scale - 0.1));
    DOM.btnZoomReset.addEventListener('click', () => setZoom(1.0));

    function setZoom(newScale) {
      newScale = Math.max(0.4, Math.min(2.5, newScale));
      state.scale = newScale;
      DOM.canvasScaler.style.transform = `scale(${newScale})`;
      DOM.zoomLabel.textContent = `${Math.round(newScale * 100)}%`;
    }

    // Snapping & Grid Toggles
    DOM.btnToggleSnap.addEventListener('click', () => {
      state.snapEnabled = !state.snapEnabled;
      DOM.btnToggleSnap.classList.toggle('active', state.snapEnabled);
      showToast(`Snapping: ${state.snapEnabled ? 'Enabled' : 'Disabled'}`);
    });

    DOM.btnToggleGrid.addEventListener('click', () => {
      state.gridEnabled = !state.gridEnabled;
      DOM.btnToggleGrid.classList.toggle('active', state.gridEnabled);
      DOM.stageScreen.classList.toggle('no-grid', !state.gridEnabled);
      showToast(`Guides: ${state.gridEnabled ? 'Visible' : 'Hidden'}`);
    });

    // Search and Filters
    DOM.layerSearchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderLayersList();
    });

    DOM.filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        DOM.filterTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.activeFilter = tab.dataset.filter;
        renderLayersList();
      });
    });

    DOM.btnCopySnippet.addEventListener('click', () => {
      navigator.clipboard.writeText(DOM.snippetCodePreview.textContent).then(() => {
        showToast('Code snippet copied to clipboard!', 'success');
      });
    });

    // Orientation Switcher Button
    if (DOM.btnOrientationToggle) {
      DOM.btnOrientationToggle.addEventListener('click', () => {
        setOrientation(state.currentOrientation === 'portrait' ? 'landscape' : 'portrait');
      });
    }

    // Scene Selector Controls for MIP Multi-Scene
    if (DOM.scenePillsContainer) {
      DOM.scenePillsContainer.querySelectorAll('.scene-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          const sceneId = pill.dataset.scene;
          if (sceneId) switchScene(sceneId);
        });
      });
    }

    if (DOM.sidebarSceneSelect) {
      DOM.sidebarSceneSelect.addEventListener('change', (e) => {
        switchScene(e.target.value);
      });
    }

    if (DOM.tabOrientPortrait) {
      DOM.tabOrientPortrait.addEventListener('click', () => setOrientation('portrait'));
    }
    if (DOM.tabOrientLandscape) {
      DOM.tabOrientLandscape.addEventListener('click', () => setOrientation('landscape'));
    }

    // Video Playback Toggle
    DOM.btnToggleVideo.addEventListener('click', () => {
      state.videoEnabled = !state.videoEnabled;
      DOM.btnToggleVideo.classList.toggle('active', state.videoEnabled);
      try {
        const doc = DOM.adFrame.contentDocument || DOM.adFrame.contentWindow.document;
        const vids = doc.querySelectorAll('video');
        vids.forEach(v => {
          if (state.videoEnabled) v.play().catch(() => {});
          else v.pause();
        });
        showToast(`Video Playback: ${state.videoEnabled ? 'Playing' : 'Paused'}`);
      } catch (e) {}
    });

    // Rescan Document
    DOM.btnRescan.addEventListener('click', () => {
      if (!state.rawHtml) {
        showToast('No HTML document loaded to rescan.', 'info');
        return;
      }
      const scanData = scanHtmlDocument(state.rawHtml, state.filename);
      applyScanData(scanData);
      loadAdInIframe(state.rawHtml);
      showToast(`Rescanned document (${scanData.elements.length} elements detected)`, 'success');
    });

    // Reset Changes back to original loaded state
    DOM.btnResetBackup.addEventListener('click', () => {
      if (!state.initialRawHtml) {
        showToast('No initial document loaded to reset.', 'info');
        return;
      }
      if (!confirm(`Are you sure you want to revert all changes made to ${state.filename}?`)) return;

      state.rawHtml = state.initialRawHtml;
      const scanData = scanHtmlDocument(state.initialRawHtml, state.filename);
      applyScanData(scanData);
      loadAdInIframe(state.initialRawHtml);
      showToast(`Reverted ${state.filename} to initial state`, 'success');
    });
  }

  // Setup Drag & Drop and Upload Triggers
  function initDragAndDrop() {
    DOM.btnOpenFile.addEventListener('click', () => DOM.fileInput.click());
    if (DOM.btnUploadPrompt) {
      DOM.btnUploadPrompt.addEventListener('click', (e) => {
        e.stopPropagation();
        DOM.fileInput.click();
      });
    }
    if (DOM.uploadPromptContainer) {
      DOM.uploadPromptContainer.addEventListener('click', () => {
        DOM.fileInput.click();
      });
    }

    DOM.fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleFileSelected(file);
    });

    const dropZones = [DOM.stageScreen, DOM.uploadPromptContainer, DOM.canvasViewport].filter(Boolean);

    dropZones.forEach(zone => {
      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (DOM.uploadPromptContainer) DOM.uploadPromptContainer.classList.add('drag-over');
      });

      zone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (DOM.uploadPromptContainer) DOM.uploadPromptContainer.classList.remove('drag-over');
      });

      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (DOM.uploadPromptContainer) DOM.uploadPromptContainer.classList.remove('drag-over');

        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
          const file = files[0];
          if (file.name.endsWith('.html') || file.name.endsWith('.htm')) {
            handleFileSelected(file);
          } else {
            showToast('Please drop a valid .html or .htm file.', 'error');
          }
        }
      });
    });
  }

  // Keyboard Shortcuts (Arrow keys to nudge)
  function initKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      const isTextInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) || document.activeElement.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && !isTextInput) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
          return;
        }
        if (e.key.toLowerCase() === 'y') {
          e.preventDefault();
          redo();
          return;
        }
      }

      if (!state.selectedElement || state.selectedElement.locked) return;
      if (isTextInput) return;

      const delta = e.shiftKey ? 1.0 : 0.1;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          updateSelectedElementPosition(state.selectedElement.x - delta, null);
          break;
        case 'ArrowRight':
          e.preventDefault();
          updateSelectedElementPosition(state.selectedElement.x + delta, null);
          break;
        case 'ArrowUp':
          e.preventDefault();
          updateSelectedElementPosition(null, state.selectedElement.y - delta);
          break;
        case 'ArrowDown':
          e.preventDefault();
          updateSelectedElementPosition(null, state.selectedElement.y + delta);
          break;
      }
    });
  }

  // Undo / Redo History Stack
  function recordHistory(description = 'Edit') {
    const snapshot = {
      description,
      elements: JSON.parse(JSON.stringify(state.elements)),
      timestamp: Date.now()
    };

    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push(snapshot);
    state.historyIndex++;

    if (state.history.length > 30) {
      state.history.shift();
      state.historyIndex--;
    }

    updateUndoRedoButtons();
  }

  function undo() {
    if (state.historyIndex > 0) {
      state.historyIndex--;
      applyHistorySnapshot(state.history[state.historyIndex]);
      showToast(`Undo: ${state.history[state.historyIndex].description}`);
    }
  }

  function redo() {
    if (state.historyIndex < state.history.length - 1) {
      state.historyIndex++;
      applyHistorySnapshot(state.history[state.historyIndex]);
      showToast(`Redo: ${state.history[state.historyIndex].description}`);
    }
  }

  function applyHistorySnapshot(snapshot) {
    state.elements = JSON.parse(JSON.stringify(snapshot.elements));
    renderLayersList();

    if (state.selectedKey) {
      const el = state.elements.find(x => x.key === state.selectedKey);
      if (el) {
        state.selectedElement = el;
        populateInspector(el);
      }
    }

    state.elements.forEach(el => {
      sendToIframe('SET_POSITION', {
        key: el.key,
        x: el.x,
        y: el.y,
        transform: el.transform,
        orientation: state.currentOrientation
      });
    });

    updateUndoRedoButtons();
  }

  function updateUndoRedoButtons() {
    DOM.btnUndo.disabled = state.historyIndex <= 0;
    DOM.btnRedo.disabled = state.historyIndex >= state.history.length - 1;
  }

  // Generate Updated HTML for SIP Video JS Templates
  async function generateUpdatedSipHtml() {
    let html = state.rawHtml;
    if (!html) throw new Error('No template HTML loaded.');

    const configRegex = /(<script\b[^>]*id=["']sip-builder-config["'][^>]*>)([\s\S]*?)(<\/script>)/i;
    const configMatch = html.match(configRegex);
    if (configMatch) {
      try {
        const config = JSON.parse(configMatch[2]);
        state.elements.forEach(el => {
          if (el.key === 'sip-countdown' && config.countdown) {
            config.countdown.position = el.position;
          } else if (el.id.startsWith('sip-dynamic-') && Array.isArray(config.dynamicTexts)) {
            const rawId = el.blockId || el.id.replace('sip-dynamic-', '');
            const item = config.dynamicTexts.find(d => d.id === rawId);
            if (item) item.position = el.position;
          } else if (el.key === 'sip-location' && config.location) {
            config.location.position = el.position;
          }
        });

        const newJson = JSON.stringify(config);
        html = html.replace(configRegex, (_, openTag, _oldJson, closeTag) => `${openTag}${newJson}${closeTag}`);
      } catch (err) {
        console.error('Error updating SIP config JSON:', err);
      }
    }

    // Clean up editor bridge
    html = html.replace(/\s*<style id=["']__reposition_editor_styles["']>[\s\S]*?<\/style>/gi, '');
    html = html.replace(/\s*<script id=["']__reposition_bridge_script["'][^>]*>[\s\S]*?<\/script>/gi, '');
    html = html.replace(/\s*<script src=["']bridge\.js[^"']*["']><\/script>/gi, '');

    return html;
  }

  // Generate Updated HTML for Standard MRAID & Universal HTML Ads
  async function generateUpdatedMraidHtml() {
    let html = state.rawHtml;
    if (!html) throw new Error('No ad template HTML loaded.');

    state.elements.forEach(el => {
      const targetPattern = new RegExp(
        `(<[a-zA-Z0-9]+[^>]*?(?:id=["']${el.key}["']|data-block-id=["']${el.key}["']|data-reposition-key=["']${el.key}["'])[^>]*?style=["'])([^"']*)(["'])`,
        'i'
      );
      const match = html.match(targetPattern);
      if (match) {
        let styleStr = match[2];
        styleStr = updateStyleProperty(styleStr, 'left', `${formatPercent(el.x)}%`);
        styleStr = updateStyleProperty(styleStr, 'top', `${formatPercent(el.y)}%`);
        if (el.width && el.width !== 'auto') styleStr = updateStyleProperty(styleStr, 'width', el.width);
        if (el.height && el.height !== 'auto') styleStr = updateStyleProperty(styleStr, 'height', el.height);
        if (el.transform) styleStr = updateStyleProperty(styleStr, 'transform', el.transform);
        if (el.fontSize) styleStr = updateStyleProperty(styleStr, 'font-size', el.fontSize);
        if (el.color) styleStr = updateStyleProperty(styleStr, 'color', el.color);
        if (el.fontWeight) styleStr = updateStyleProperty(styleStr, 'font-weight', el.fontWeight);
        if (el.textAlign) styleStr = updateStyleProperty(styleStr, 'text-align', el.textAlign);

        html = html.replace(targetPattern, (_, prefix, _oldStyle, quote) => `${prefix}${styleStr}${quote}`);
      } else {
        const noStylePattern = new RegExp(
          `(<[a-zA-Z0-9]+[^>]*?(?:id=["']${el.key}["']|data-block-id=["']${el.key}["']|data-reposition-key=["']${el.key}["']))([^>]*>)`,
          'i'
        );
        const matchNoStyle = html.match(noStylePattern);
        if (matchNoStyle && !matchNoStyle[1].includes('style=')) {
          const newStyle = `style="position:absolute;left:${formatPercent(el.x)}%;top:${formatPercent(el.y)}%;"`;
          html = html.replace(noStylePattern, (_, prefix, rest) => `${prefix} ${newStyle}${rest}`);
        }
      }
    });

    if (state.layoutBlocksData && Array.isArray(state.layoutBlocksData.blocks)) {
      state.elements.forEach(el => {
        const blk = state.layoutBlocksData.blocks.find(b => b.id === el.blockId || b.id === el.id);
        if (blk) {
          blk.x = formatPercent(el.x);
          blk.y = formatPercent(el.y);
          if (el.width && el.width.includes('%')) {
            const m = el.width.match(/([-\d.]+)/);
            if (m) blk.width = parseFloat(m[1]);
          }
          if (el.fontSize && el.fontSize.includes('cqmin')) {
            const m = el.fontSize.match(/([-\d.]+)/);
            if (m) blk.fontSize = parseFloat(m[1]);
          }
          if (el.color) blk.color = el.color;
          if (el.fontWeight) blk.fontWeight = parseInt(el.fontWeight, 10) || el.fontWeight;
          if (el.textAlign) blk.align = el.textAlign;
        }
      });

      const updatedJsonStr = JSON.stringify(state.layoutBlocksData);
      const jsonRegex = /(<script type=["']application\/json["']\s+id=["']__layout_blocks["'][^>]*>)([\s\S]*?)(<\/script>)/i;
      html = html.replace(jsonRegex, (_, openTag, _oldJson, closeTag) => `${openTag}${updatedJsonStr}${closeTag}`);
    }

    // Clean up editor bridge
    html = html.replace(/\s*<style id=["']__reposition_editor_styles["']>[\s\S]*?<\/style>/gi, '');
    html = html.replace(/\s*<script id=["']__reposition_bridge_script["'][^>]*>[\s\S]*?<\/script>/gi, '');
    html = html.replace(/\s*<script src=["']bridge\.js[^"']*["']><\/script>/gi, '');
    html = html.replace(/\s*class=["'][^"']*editor-selected-element[^"']*["']/gi, (match) => {
      return match.replace(/\s*editor-selected-element\s*/g, ' ').replace(/\s*is-dragging\s*/g, ' ');
    });

    return html;
  }

  // Generate Updated HTML for MIP Multi-Scene Creatives
  async function generateUpdatedMipHtml() {
    let html = state.rawHtml;
    if (!html) throw new Error('No template HTML loaded.');

    const changedElements = state.elements.filter(el => {
      const origX = formatPercent(el.originalX !== undefined ? el.originalX : 50);
      const origY = formatPercent(el.originalY !== undefined ? el.originalY : 50);
      const curX = formatPercent(el.x);
      const curY = formatPercent(el.y);
      return origX !== curX || origY !== curY;
    });

    if (changedElements.length > 0) {
      let customCss = '\n    /* Reposition Studio Customized Positions */\n';
      changedElements.forEach(el => {
        const selector = el.className ? `.${el.className.split(' ')[0]}` : `#${el.key}`;
        customCss += `    ${selector} { position: absolute !important; left: ${formatPercent(el.x)}% !important; top: ${formatPercent(el.y)}% !important; }\n`;
      });

      const overrideTag = `<style id="__reposition_mip_overrides">${customCss}    </style>\n`;
      if (html.includes('id="__reposition_mip_overrides"')) {
        html = html.replace(/<style id="__reposition_mip_overrides">[\s\S]*?<\/style>/i, () => overrideTag);
      } else if (/<\/head>/i.test(html)) {
        html = html.replace(/<\/head>/i, () => `${overrideTag}</head>`);
      } else {
        html = overrideTag + html;
      }
    }

    // Clean up editor bridge
    html = html.replace(/\s*<style id=["']__reposition_editor_styles["']>[\s\S]*?<\/style>/gi, '');
    html = html.replace(/\s*<style id=["']__mip_scene_display_override["']>[\s\S]*?<\/style>/gi, '');
    html = html.replace(/\s*<script id=["']__reposition_bridge_script["'][^>]*>[\s\S]*?<\/script>/gi, '');
    html = html.replace(/\s*<script src=["']bridge\.js[^"']*["']><\/script>/gi, '');

    return html;
  }

  async function generateUpdatedHtml() {
    if (state.templateType === 'sip') {
      return await generateUpdatedSipHtml();
    }
    if (state.templateType === 'mip') {
      return await generateUpdatedMipHtml();
    }
    return await generateUpdatedMraidHtml();
  }

  function updateStyleProperty(styleStr, prop, val) {
    const regex = new RegExp(`(${prop}\\s*:\\s*)([^;]+)(;?)`, 'i');
    if (regex.test(styleStr)) {
      return styleStr.replace(regex, (_, p1, _p2, p3) => `${p1}${val}${p3}`);
    } else {
      const clean = styleStr.trim().replace(/;$/, '');
      return clean ? `${clean};${prop}:${val};` : `${prop}:${val};`;
    }
  }

  // Save to File (Server save and instant download fallback)
  async function saveToFile() {
    try {
      showToast(`Compiling updated ${state.filename || 'ad.html'}...`, 'info');
      const updatedHtml = await generateUpdatedHtml();

      let savedOnServer = false;
      if (state.isServerMode) {
        try {
          const saveUrl = `${state.serverApiBase}/api/save`;
          const res = await fetch(saveUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: state.filename || 'repositioned_ad.html', html: updatedHtml }),
            signal: AbortSignal.timeout(3000)
          });

          if (res.ok) {
            const data = await res.json();
            if (data.success) {
              savedOnServer = true;
              showToast(`Saved ${state.filename} directly to disk! (Backup: ${data.backup})`, 'success');
              DOM.diffModal.classList.remove('open');
            }
          }
        } catch (err) {}
      }

      triggerDownload(updatedHtml, state.filename || 'repositioned_ad.html');
      DOM.diffModal.classList.remove('open');
    } catch (err) {
      console.error('Save failed:', err);
      showToast('Save failed: ' + err.message, 'error');
      alert(err.message);
    }
  }

  function triggerDownload(content, filename) {
    if (!content || content.length < 50) {
      showToast('Export error: HTML content is empty', 'error');
      return;
    }
    const blob = new Blob([content], { type: 'text/html; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename ? filename.replace(/\.html$/i, '_repositioned.html') : 'repositioned_ad.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${a.download} (${(blob.size / 1024 / 1024).toFixed(2)} MB)!`, 'success');
  }

  // Diff Modal
  function openDiffModal() {
    DOM.diffTableBody.innerHTML = '';

    const changedElements = state.elements.filter(el => {
      const origX = formatPercent(el.originalX);
      const origY = formatPercent(el.originalY);
      const curX = formatPercent(el.x);
      const curY = formatPercent(el.y);
      return origX !== curX || origY !== curY;
    });

    if (changedElements.length === 0) {
      DOM.diffTableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 30px;">
            No position changes detected yet. Drag an element or adjust X/Y inputs to view diff.
          </td>
        </tr>
      `;
    } else {
      changedElements.forEach(el => {
        const origX = formatPercent(el.originalX);
        const origY = formatPercent(el.originalY);
        const curX = formatPercent(el.x);
        const curY = formatPercent(el.y);
        const deltaX = (curX - origX).toFixed(2);
        const deltaY = (curY - origY).toFixed(2);

        const row = document.createElement('tr');
        row.innerHTML = `
          <td><strong>${escapeHtml(el.blockId || el.id || el.key)}</strong></td>
          <td>${origX}% / ${origY}%</td>
          <td><span style="color: #10b981; font-weight: 600;">${curX}% / ${curY}%</span></td>
          <td>
            <span class="diff-badge ${deltaX >= 0 ? 'added' : 'removed'}">${deltaX >= 0 ? '+' : ''}${deltaX}% X</span>
            <span class="diff-badge ${deltaY >= 0 ? 'added' : 'removed'}">${deltaY >= 0 ? '+' : ''}${deltaY}% Y</span>
          </td>
          <td>
            <button class="btn btn-sm btn-secondary btn-revert-row" data-key="${el.key}">Revert</button>
          </td>
        `;
        DOM.diffTableBody.appendChild(row);
      });

      DOM.diffTableBody.querySelectorAll('.btn-revert-row').forEach(btn => {
        btn.addEventListener('click', () => {
          const key = btn.dataset.key;
          const el = state.elements.find(x => x.key === key);
          if (el) {
            updateSelectedElementPosition(el.originalX, el.originalY);
            openDiffModal();
            showToast(`Reverted ${key} to original position`);
          }
        });
      });
    }

    DOM.diffModal.classList.add('open');
  }

  // Modals & Action Listeners
  function initModals() {
    DOM.btnDiff.addEventListener('click', openDiffModal);
    DOM.btnCloseDiff.addEventListener('click', () => DOM.diffModal.classList.remove('open'));
    DOM.btnCancelDiff.addEventListener('click', () => DOM.diffModal.classList.remove('open'));
    DOM.btnSaveFromDiff.addEventListener('click', saveToFile);

    DOM.btnExport.addEventListener('click', () => {
      const titleEl = document.getElementById('exportDownloadTitle');
      if (titleEl) titleEl.textContent = `Download ${state.filename || 'ad.html'}`;
      DOM.exportModal.classList.add('open');
    });
    DOM.btnCloseExport.addEventListener('click', () => DOM.exportModal.classList.remove('open'));

    DOM.btnSaveFile.addEventListener('click', saveToFile);

    DOM.btnDownloadHtml.addEventListener('click', async () => {
      try {
        const html = await generateUpdatedHtml();
        triggerDownload(html, state.filename);
        DOM.exportModal.classList.remove('open');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    DOM.btnCopyHtml.addEventListener('click', async () => {
      try {
        showToast(`Compiling updated HTML...`, 'info');
        const html = await generateUpdatedHtml();
        await navigator.clipboard.writeText(html);
        showToast(`Full HTML (${(html.length / 1024 / 1024).toFixed(2)} MB) copied to clipboard!`, 'success');
      } catch (err) {
        console.error('Copy error:', err);
        showToast(err.message, 'error');
      }
    });

    DOM.btnCopyJson.addEventListener('click', () => {
      const dataToCopy = state.templateType === 'sip' ? state.sipConfig : state.layoutBlocksData;
      if (!dataToCopy) {
        showToast('No JSON configuration found in document', 'error');
        return;
      }
      navigator.clipboard.writeText(JSON.stringify(dataToCopy, null, 2)).then(() => {
        showToast('Configuration JSON copied to clipboard!', 'success');
      });
    });

    window.addEventListener('click', (e) => {
      if (e.target === DOM.diffModal) DOM.diffModal.classList.remove('open');
      if (e.target === DOM.exportModal) DOM.exportModal.classList.remove('open');
    });
  }

  // Initialization: Ready for user to upload HTML before starting!
  function init() {
    initInputListeners();
    initKeyboardShortcuts();
    initToolbarControls();
    initModals();
    initDragAndDrop();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
