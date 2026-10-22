/**
 * MRAID & Universal HTML Ad Reposition Studio - In-Frame Editor Bridge
 * Supports both CSS-based layout templates, SIP Video JS templates,
 * and arbitrary HTML5 / MRAID banner ads.
 */
(function () {
  'use strict';

  // Only activate editor when inside an iframe / editor parent
  if (window === window.parent) return;

  // Prevent duplicate initializations
  if (window.__repositionBridgeLoaded) return;
  window.__repositionBridgeLoaded = true;

  console.log('[Bridge] Reposition Studio Bridge initializing inside ad iframe...');

  // Inject Editor Styles
  const style = document.createElement('style');
  style.id = '__reposition_editor_styles';
  style.textContent = `
    /* Force all repositionable ad elements to receive pointer events */
    .repositionable-element,
    [data-reposition-key],
    .tb, .rb, #ctaBtn, .strip, [data-block-id],
    #sip-countdown, [id^="sip-dynamic-"], [id^="sip-custom-"], #sip-countup {
      pointer-events: auto !important;
      cursor: grab !important;
      user-select: none !important;
      -webkit-user-select: none !important;
      transition: outline 120ms ease, box-shadow 120ms ease;
    }

    .repositionable-element:hover,
    [data-reposition-key]:hover,
    .tb:hover, .rb:hover, #ctaBtn:hover, .strip:hover, [data-block-id]:hover,
    #sip-countdown:hover, [id^="sip-dynamic-"]:hover, [id^="sip-custom-"]:hover, #sip-countup:hover {
      outline: 2px dashed rgba(99, 102, 241, 0.9) !important;
      outline-offset: 3px !important;
    }

    /* Active selected element */
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

    /* Snap Guide Lines */
    #editorSnapV {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 50%;
      width: 1.5px;
      background: #06b6d4;
      box-shadow: 0 0 8px #06b6d4;
      pointer-events: none;
      z-index: 99998;
      display: none;
    }

    #editorSnapH {
      position: absolute;
      left: 0;
      right: 0;
      top: 50%;
      height: 1.5px;
      background: #ec4899;
      box-shadow: 0 0 8px #ec4899;
      pointer-events: none;
      z-index: 99998;
      display: none;
    }
  `;
  document.head ? document.head.appendChild(style) : document.documentElement.appendChild(style);

  // Helper to determine current viewport orientation
  function isPortraitViewportNow() {
    return window.matchMedia
      ? !window.matchMedia("(orientation: landscape)").matches
      : window.innerHeight > window.innerWidth;
  }

  // Setup Snap Guides
  function setupGuides() {
    const container = document.getElementById('stage') ||
                      document.getElementById('video-container') ||
                      document.getElementById('overlay') ||
                      document.getElementById('root') ||
                      document.body;
    if (!container) return;

    let guideV = document.getElementById('editorSnapV');
    let guideH = document.getElementById('editorSnapH');
    if (!guideV) {
      guideV = document.createElement('div');
      guideV.id = 'editorSnapV';
      container.appendChild(guideV);
    }
    if (!guideH) {
      guideH = document.createElement('div');
      guideH.id = 'editorSnapH';
      container.appendChild(guideH);
    }
  }

  // State
  let activeElement = null;
  let isDragging = false;
  let dragStart = {};

  function parsePercentVal(val, defaultVal = 50) {
    if (val === undefined || val === null || val === '') return defaultVal;
    const m = String(val).match(/([-\d.]+)/);
    return m ? parseFloat(m[1]) : defaultVal;
  }

  function getElementKey(el) {
    if (!el) return '';
    if (el.getAttribute('data-reposition-key')) return el.getAttribute('data-reposition-key');
    if (el.id) return el.id;
    if (el.getAttribute('data-block-id')) return el.getAttribute('data-block-id');
    if (el.className && typeof el.className === 'string') {
      const classes = el.className.split(/\s+/).filter(c => !c.startsWith('editor-') && !c.startsWith('repositionable-') && !c.includes('is-'));
      if (classes.length > 0) return classes[0];
    }
    return 'element';
  }

  function findElementByKey(key) {
    if (!key) return null;
    return document.querySelector(`[data-reposition-key="${key}"]`) ||
           document.getElementById(key) ||
           document.querySelector(`[data-block-id="${key}"]`) ||
           document.querySelector(`.${key}`) ||
           document.querySelector(key);
  }

  function getSipPositionObj(key) {
    if (window.__sipPositions && window.__sipPositions[key]) {
      return window.__sipPositions[key];
    }
    return null;
  }

  function isContainerElement(el) {
    if (!el || el === document.body || el === document.documentElement) return true;
    const id = (el.id || '').toLowerCase();
    const tag = (el.tagName || '').toLowerCase();
    const cls = typeof el.className === 'string' ? el.className.toLowerCase() : '';
    if (['html', 'head', 'body', 'script', 'style', 'link', 'meta'].includes(tag)) return true;
    if (['root', 'stage', 'overlay', 'bgblur', 'bg', 'video-container', 'sip-video'].includes(id)) return true;
    if (cls.includes('intro-scene-layer') || cls.includes('chat-layer--question') || cls.includes('chat-layer--reaction') || cls.includes('endcard-layer')) {
      return true;
    }
    return false;
  }

  function findRepositionTarget(target) {
    if (!target || target === document.body || target === document.documentElement) return null;

    const ctaContainer = target.closest('#ctaBtn');
    if (ctaContainer) return ctaContainer;

    // Check closest repositionable element
    const closest = target.closest(
      '[data-reposition-key], .repositionable-element, .tb, .rb, #ctaBtn, .strip, [data-block-id], ' +
      '#sip-countdown, [id^="sip-dynamic-"], [id^="sip-custom-"], #sip-countup, ' +
      '.intro-copy, .intro-traits, .intro-copy-description, .tap-hand, .intro-hitbox, ' +
      '.chat-bubble, .prompt-row, .profile-icon, .answer-stack, .answer-option, .answer-hitbox, .answer-guide-hand, ' +
      '.outgoing-row, .reply-row, .typing-dots, ' +
      '.endcard-content, .endcard-logo, .endcard-title, .endcard-subtitle, .endcard-desc, .endcard-cta-btn, .endcard-mascot, .endcard-card'
    );
    if (closest && !isContainerElement(closest)) return closest;

    // Walk up until we find an identifiable candidate
    let cur = target;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      if (isContainerElement(cur)) {
        cur = cur.parentElement;
        continue;
      }
      if (cur.getAttribute('data-reposition-key') || cur.id || cur.getAttribute('data-block-id')) {
        return cur;
      }
      if (cur.style && (cur.style.left || cur.style.top || cur.style.position === 'absolute')) {
        return cur;
      }
      if (/^(h[1-6]|p|button|a|img|svg|span|div)$/i.test(cur.tagName) && cur.textContent.trim().length > 0) {
        return cur;
      }
      cur = cur.parentElement;
    }
    return null;
  }

  // Tag candidate elements across document
  function tagRepositionableElements() {
    const candidates = document.querySelectorAll(
      '[data-block-id], [id], .tb, .rb, #ctaBtn, .strip, [id^="sip-"], ' +
      'h1, h2, h3, h4, h5, h6, p, button, a, img, svg, div'
    );

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
          const key = el.id || el.getAttribute('data-block-id') || `elem_${autoIdx++}`;
          el.setAttribute('data-reposition-key', key);
        }
      }
    });
  }

  // Start dragging a target element
  function startElementDrag(el, e) {
    selectElement(el);

    isDragging = true;
    el.classList.add('is-dragging');
    try { el.setPointerCapture(e.pointerId); } catch (err) {}

    const key = getElementKey(el);
    const sipInfo = getSipPositionObj(key);

    if (sipInfo) {
      // SIP Dynamic JS Positioning Mode
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
        isSip: true,
        pointerX: e.clientX,
        pointerY: e.clientY,
        startAnchorX: targetAnchor.x !== undefined ? targetAnchor.x : 0.5,
        startAnchorY: targetAnchor.y !== undefined ? targetAnchor.y : 0.2,
        iw,
        ih,
        scale,
        orientation,
        sipInfo,
        el
      };
    } else {
      // Standard MRAID / CSS Percentage Mode
      const stage = document.getElementById('stage') ||
                    document.getElementById('video-container') ||
                    document.getElementById('root') ||
                    document.body;
      const stageRect = stage.getBoundingClientRect();

      // Ensure positioned
      const comp = window.getComputedStyle(el);
      if (comp.position === 'static') {
        el.style.position = 'absolute';
      }

      // Calculate initial percentage relative to stage
      let curX = parsePercentVal(el.style.left, null);
      let curY = parsePercentVal(el.style.top, null);

      if (curX === null || curY === null) {
        const elRect = el.getBoundingClientRect();
        if (stageRect.width > 0) curX = ((elRect.left - stageRect.left) / stageRect.width) * 100;
        if (stageRect.height > 0) curY = ((elRect.top - stageRect.top) / stageRect.height) * 100;
      }

      dragStart = {
        isSip: false,
        pointerX: e.clientX,
        pointerY: e.clientY,
        elemX: curX !== null ? curX : 50,
        elemY: curY !== null ? curY : 50,
        stageW: stageRect.width || 360,
        stageH: stageRect.height || 640,
        el
      };
    }
  }

  // Global Pointer Events
  function initPointerHandlers() {
    // 1. Pointerdown - Capture Phase (Intercepts all clicks)
    document.addEventListener('pointerdown', (e) => {
      const target = findRepositionTarget(e.target);
      if (!target) return;

      // Prevent default ad navigation/triggers
      e.preventDefault();
      e.stopPropagation();

      startElementDrag(target, e);
    }, true);

    // 2. Pointermove
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

        // Magnetic Center Snapping (0.5)
        const guideV = document.getElementById('editorSnapV');
        if (Math.abs(newAnchorX - 0.5) < 0.015) {
          newAnchorX = 0.5;
          if (guideV) { guideV.style.left = '50%'; guideV.style.display = 'block'; }
        } else if (guideV) {
          guideV.style.display = 'none';
        }

        newAnchorX = Math.max(0.01, Math.min(0.99, newAnchorX));
        newAnchorY = Math.max(0.01, Math.min(0.99, newAnchorY));

        const targetAnchor = dragStart.orientation === 'portrait'
          ? dragStart.sipInfo.portrait
          : dragStart.sipInfo.landscape;

        targetAnchor.x = newAnchorX;
        targetAnchor.y = newAnchorY;

        if (typeof dragStart.sipInfo.update === 'function') {
          dragStart.sipInfo.update();
        }

        window.parent.postMessage({
          type: 'ELEMENT_DRAGGING',
          key: key,
          x: parseFloat((newAnchorX * 100).toFixed(2)),
          y: parseFloat((newAnchorY * 100).toFixed(2)),
          anchorX: newAnchorX,
          anchorY: newAnchorY,
          isSip: true,
          orientation: dragStart.orientation
        }, '*');

      } else {
        let newX = dragStart.elemX + (dx / dragStart.stageW) * 100;
        let newY = dragStart.elemY + (dy / dragStart.stageH) * 100;

        if (e.shiftKey) {
          if (Math.abs(dx) > Math.abs(dy)) newY = dragStart.elemY;
          else newX = dragStart.elemX;
        }

        // Magnetic Center Snapping (50%)
        const guideV = document.getElementById('editorSnapV');
        if (Math.abs(newX - 50) < 1.4) {
          newX = 50;
          if (guideV) { guideV.style.left = '50%'; guideV.style.display = 'block'; }
        } else if (guideV) {
          guideV.style.display = 'none';
        }

        dragStart.el.style.left = `${newX.toFixed(2)}%`;
        dragStart.el.style.top = `${newY.toFixed(2)}%`;

        window.parent.postMessage({
          type: 'ELEMENT_DRAGGING',
          key: key,
          x: parseFloat(newX.toFixed(2)),
          y: parseFloat(newY.toFixed(2)),
          isSip: false
        }, '*');
      }
    }, true);

    // 3. Pointerup / cancel
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
        const targetAnchor = dragStart.orientation === 'portrait'
          ? dragStart.sipInfo.portrait
          : dragStart.sipInfo.landscape;

        window.parent.postMessage({
          type: 'ELEMENT_DRAG_END',
          key: key,
          x: parseFloat((targetAnchor.x * 100).toFixed(2)),
          y: parseFloat((targetAnchor.y * 100).toFixed(2)),
          anchorX: targetAnchor.x,
          anchorY: targetAnchor.y,
          isSip: true,
          orientation: dragStart.orientation
        }, '*');
      } else if (dragStart.el) {
        const finalX = parsePercentVal(dragStart.el.style.left, 50);
        const finalY = parsePercentVal(dragStart.el.style.top, 50);

        window.parent.postMessage({
          type: 'ELEMENT_DRAG_END',
          key: key,
          x: finalX,
          y: finalY,
          isSip: false
        }, '*');
      }
    };

    document.addEventListener('pointerup', onPointerEnd, true);
    document.addEventListener('pointercancel', onPointerEnd, true);

    // 4. Click event interception (Stops ad links / mraid triggers from navigating)
    document.addEventListener('click', (e) => {
      const target = findRepositionTarget(e.target);
      if (target) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
  }

  // Select an Element
  function selectElement(el) {
    if (!el) return;

    if (activeElement && activeElement !== el) {
      activeElement.classList.remove('editor-selected-element');
    }
    activeElement = el;
    el.classList.add('editor-selected-element');

    const key = getElementKey(el);
    const sipInfo = getSipPositionObj(key);

    if (sipInfo) {
      const isPortrait = isPortraitViewportNow();
      const orientation = isPortrait ? 'portrait' : 'landscape';
      const anchor = isPortrait ? sipInfo.portrait : sipInfo.landscape;

      window.parent.postMessage({
        type: 'ELEMENT_SELECTED',
        key: key,
        x: parseFloat(((anchor.x !== undefined ? anchor.x : 0.5) * 100).toFixed(2)),
        y: parseFloat(((anchor.y !== undefined ? anchor.y : 0.2) * 100).toFixed(2)),
        isSip: true,
        orientation: orientation,
        portraitAnchor: sipInfo.portrait,
        landscapeAnchor: sipInfo.landscape
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

      window.parent.postMessage({
        type: 'ELEMENT_SELECTED',
        key: key,
        x: x !== null ? x : 50,
        y: y !== null ? y : 50,
        isSip: false
      }, '*');
    }
  }

  // Listen for Messages from Parent Editor
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

        if (typeof sipInfo.update === 'function') {
          sipInfo.update();
        }
      } else {
        const el = findElementByKey(data.key);
        if (el) {
          const comp = window.getComputedStyle(el);
          if (comp.position === 'static') {
            el.style.position = 'absolute';
          }
          if (data.x !== undefined) el.style.left = `${parseFloat(data.x).toFixed(2)}%`;
          if (data.y !== undefined) el.style.top = `${parseFloat(data.y).toFixed(2)}%`;
          if (data.transform !== undefined) el.style.transform = data.transform;
        }
      }
    } else if (data.type === 'SELECT_ELEMENT') {
      const el = findElementByKey(data.key);
      if (el) {
        selectElement(el);
        try {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        } catch (err) {}
      }
    } else if (data.type === 'SET_STYLE') {
      const el = findElementByKey(data.key);
      if (el && data.property && data.value !== undefined) {
        el.style[data.property] = data.value;
      }
    } else if (data.type === 'SET_SCENE') {
      const scene = data.scene;
      console.log('[Bridge] Setting active scene to:', scene);

      // 1. Invoke React state setter if hooked
      if (typeof window.__setCreativeScene === 'function') {
        try { window.__setCreativeScene(scene); } catch (e) { console.warn(e); }
      } else if (typeof window.__internalSetScene === 'function') {
        try { window.__internalSetScene(scene); } catch (e) { console.warn(e); }
      }

      // 2. Apply CSS visibility overrides for scene layers
      applySceneVisibilityOverrides(scene);

      // 3. Re-tag elements and notify parent editor
      setTimeout(() => {
        tagRepositionableElements();
        notifySceneElements(scene);
      }, 150);
    }
  });

  // Scene Visibility Overrides for Multi-Scene Ad Creatives
  function applySceneVisibilityOverrides(scene) {
    let overrideStyle = document.getElementById('__mip_scene_display_override');
    if (!overrideStyle) {
      overrideStyle = document.createElement('style');
      overrideStyle.id = '__mip_scene_display_override';
      (document.head || document.documentElement).appendChild(overrideStyle);
    }

    if (scene === 'intro') {
      overrideStyle.textContent = `
        .intro-scene-layer, .intro-layer { display: block !important; opacity: 1 !important; visibility: visible !important; pointer-events: auto !important; }
        .chat-layer--question, .chat-layer--reaction, .endcard-layer { display: none !important; }
      `;
    } else if (scene === 'question') {
      overrideStyle.textContent = `
        .chat-layer--question, .chat-layer { display: flex !important; opacity: 1 !important; visibility: visible !important; pointer-events: auto !important; }
        .prompt-row, .answer-stack { display: flex !important; opacity: 1 !important; visibility: visible !important; pointer-events: auto !important; }
        .intro-scene-layer, .intro-layer, .chat-layer--reaction, .endcard-layer { display: none !important; }
      `;
    } else if (scene === 'reaction') {
      overrideStyle.textContent = `
        .chat-layer--reaction, .chat-layer { display: flex !important; opacity: 1 !important; visibility: visible !important; pointer-events: auto !important; }
        .outgoing-row, .reply-row { display: flex !important; opacity: 1 !important; visibility: visible !important; pointer-events: auto !important; }
        .intro-scene-layer, .intro-layer, .chat-layer--question, .endcard-layer { display: none !important; }
      `;
    } else if (scene === 'endcard') {
      overrideStyle.textContent = `
        .endcard-layer { display: flex !important; opacity: 1 !important; visibility: visible !important; pointer-events: auto !important; }
        .endcard-content, .endcard-card, .endcard-logo, .endcard-title, .endcard-subtitle, .endcard-desc, .endcard-cta-btn, .endcard-mascot { opacity: 1 !important; visibility: visible !important; pointer-events: auto !important; }
        .intro-scene-layer, .intro-layer, .chat-layer--question, .chat-layer--reaction { display: none !important; }
      `;
    } else if (scene === 'all') {
      overrideStyle.textContent = `
        .intro-scene-layer, .chat-layer--question, .chat-layer--reaction, .endcard-layer { display: block !important; opacity: 0.9 !important; pointer-events: auto !important; }
      `;
    }
  }

  // Scan live elements for active scene and post to parent
  function notifySceneElements(scene) {
    const stage = document.getElementById('stage') || document.getElementById('root') || document.body;
    const stageRect = stage.getBoundingClientRect();
    const visibleElements = [];

    const candidates = document.querySelectorAll(
      '.repositionable-element, [data-reposition-key], ' +
      '.intro-copy, .intro-traits, .intro-copy-description, .tap-hand, .intro-hitbox, ' +
      '.chat-bubble, .prompt-row, .profile-icon, .answer-stack, .answer-option, .answer-hitbox, ' +
      '.outgoing-row, .reply-row, .typing-dots, ' +
      '.endcard-content, .endcard-logo, .endcard-title, .endcard-subtitle, .endcard-desc, .endcard-cta-btn, .endcard-mascot, .endcard-card'
    );

    candidates.forEach(el => {
      if (isContainerElement(el)) return;
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const key = getElementKey(el);
        let x = 50;
        let y = 50;
        if (stageRect.width > 0) x = parseFloat((((rect.left - stageRect.left) / stageRect.width) * 100).toFixed(2));
        if (stageRect.height > 0) y = parseFloat((((rect.top - stageRect.top) / stageRect.height) * 100).toFixed(2));

        visibleElements.push({
          key: key,
          id: el.id || null,
          tag: el.tagName.toLowerCase(),
          className: el.className || '',
          text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
          left: `${x}%`,
          top: `${y}%`,
          x: x,
          y: y,
          scene: scene || 'global'
        });
      }
    });

    window.parent.postMessage({
      type: 'SCENE_ELEMENTS_SCANNED',
      scene: scene,
      elements: visibleElements
    }, '*');
  }

  // Initialization
  function init() {
    setupGuides();
    tagRepositionableElements();
    initPointerHandlers();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
