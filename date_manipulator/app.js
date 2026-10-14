/**
 * Dynamic Date, Time & Language Manipulator - Application Controller
 */

// Device Dimension Specifications
const DEVICE_CONFIGS = {
  iphone16: {
    name: 'iPhone 16',
    width: 393,
    height: 852,
    type: 'iphone',
    borderRadius: '52px',
    screenRadius: '42px',
    hasIsland: true
  },
  iphone16promax: {
    name: 'iPhone 16 Pro Max',
    width: 440,
    height: 956,
    type: 'iphone',
    borderRadius: '54px',
    screenRadius: '44px',
    hasIsland: true
  },
  ipad: {
    name: 'iPad Air / Pro (11")',
    width: 820,
    height: 1180,
    type: 'ipad',
    borderRadius: '28px',
    screenRadius: '16px',
    hasIsland: false
  },
  mobile: {
    name: 'Standard Mobile',
    width: 375,
    height: 667,
    type: 'mobile',
    borderRadius: '40px',
    screenRadius: '30px',
    hasIsland: false
  }
};

// Built-in Dynamic Multilingual Demo Creative
const DEMO_TEMPLATE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dynamic Date & Multilingual Creative Demo</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      color: #ffffff;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      padding: 24px 20px;
      text-align: center;
      overflow: auto;
    }
    .badge {
      background: rgba(255, 255, 255, 0.15);
      border: 1px solid rgba(255, 255, 255, 0.25);
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 12px;
      backdrop-filter: blur(8px);
    }
    .hero-title {
      font-size: 26px;
      font-weight: 800;
      line-height: 1.2;
      margin-bottom: 8px;
      background: linear-gradient(to right, #60a5fa, #a78bfa, #f472b6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .hero-subtitle {
      font-size: 13px;
      color: #94a3b8;
      margin-bottom: 20px;
    }
    .card {
      background: rgba(255, 255, 255, 0.07);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 16px;
      padding: 18px 16px;
      width: 100%;
      max-width: 380px;
      margin-bottom: 14px;
      backdrop-filter: blur(12px);
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3);
    }
    .date-highlight {
      font-size: 20px;
      font-weight: 700;
      color: #38bdf8;
      margin-top: 4px;
      letter-spacing: -0.02em;
    }
    .time-highlight {
      font-size: 32px;
      font-weight: 800;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      color: #facc15;
      margin: 8px 0;
      letter-spacing: 0.04em;
    }
    .lang-section {
      text-align: left;
      font-size: 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .lang-row {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding-bottom: 4px;
    }
    .lang-label { color: #94a3b8; font-weight: 500; }
    .lang-val { color: #f1f5f9; font-weight: 600; }
    .cta-btn {
      width: 100%;
      max-width: 380px;
      background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
      color: white;
      font-weight: 700;
      font-size: 14px;
      border: none;
      padding: 14px;
      border-radius: 12px;
      cursor: pointer;
      box-shadow: 0 4px 15px rgba(37, 99, 235, 0.4);
      margin-top: 10px;
      transition: transform 0.2s;
    }
    .cta-btn:active { transform: scale(0.98); }
  </style>
</head>
<body>
  <div>
    <div class="badge" id="promo-badge">⚡ SPECIAL OFFER TODAY ONLY</div>
    <h1 class="hero-title" id="greeting-title">Flash Sale Event</h1>
    <p class="hero-subtitle" id="greeting-desc">Dynamic date and language simulated seamlessly</p>
  </div>

  <!-- Live Date & Clock Card -->
  <div class="card">
    <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em;">Current Simulated Date</div>
    <div class="date-highlight" id="date-display">Loading...</div>
    <div class="time-highlight" id="clock-display">00:00:00</div>
    <div style="font-size: 11px; color: #cbd5e1;" id="relative-time-display">Today</div>
  </div>

  <!-- Localized Info Card -->
  <div class="card">
    <div class="lang-section">
      <div class="lang-row">
        <span class="lang-label">navigator.language:</span>
        <span class="lang-val" id="nav-lang">--</span>
      </div>
      <div class="lang-row">
        <span class="lang-label">Locale Month Name:</span>
        <span class="lang-val" id="month-name">--</span>
      </div>
      <div class="lang-row">
        <span class="lang-label">Locale Day Name:</span>
        <span class="lang-val" id="day-name">--</span>
      </div>
      <div class="lang-row">
        <span class="lang-label">Formatted Currency:</span>
        <span class="lang-val" id="currency-display">--</span>
      </div>
    </div>
  </div>

  <button class="cta-btn" id="cta-button">CLAIM OFFER NOW</button>

  <script>
    // Greetings Dictionary by primary language
    const GREETINGS = {
      'en': { badge: '⚡ TODAY ONLY FLASH SALE', title: 'Exclusive Special Offer', desc: 'Valid only for today', cta: 'CLAIM OFFER NOW' },
      'es': { badge: '⚡ OFERTA SOLO POR HOY', title: 'Venta Flash Exclusiva', desc: 'Válido únicamente por el día de hoy', cta: 'RECLAMAR OFERTA AHORA' },
      'fr': { badge: '⚡ OFFRE SPÉCIALE AUJOURD\\x27HUI', title: 'Vente Flash Exclusive', desc: 'Valable uniquement aujourd\\x27hui', cta: 'RÉCLAMER L\\x27OFFRE' },
      'de': { badge: '⚡ NUR HEUTE GÜLTIG', title: 'Exklusiver Blitzverkauf', desc: 'Nur für den heutigen Tag gültig', cta: 'JETZT ANGEBOT SICHERN' },
      'it': { badge: '⚡ SOLO PER OGGI', title: 'Offerta Lampo Esclusiva', desc: 'Valido solo per oggi', cta: 'RICHIEDI L\\x27OFFERTA' },
      'pt': { badge: '⚡ OFERTA APENAS HOJE', title: 'Super Promoção Relâmpago', desc: 'Válido somente para a data de hoje', cta: 'GARANTIR OFERTA AGORA' },
      'ja': { badge: '⚡ 本日限定特別セール', title: 'プレミアム特別オファー', desc: '本日中のみ有効な限定特典です', cta: '今すぐ特典を受け取る' },
      'zh': { badge: '⚡ 仅限今日限时特惠', title: '专属限时抢购活动', desc: '优惠仅限今日有效，不可错过', cta: '立即领取特惠' },
      'ko': { badge: '⚡ 오늘 하루 특별 할인', title: '단독 플래시 세일', desc: '오직 오늘만 제공되는 특별 혜택', cta: '지금 바로 혜택받기' },
      'fil': { badge: '⚡ PARA SA ARAW NA ITO LAMANG', title: 'Eksklusibong Flash Sale', desc: 'Wasto lamang para sa araw na ito', cta: 'KUNIN ANG ALOK NGAYON' },
      'ru': { badge: '⚡ ТОЛЬКО СЕГОДНЯ', title: 'Эксклюзивная распродажа', desc: 'Действительно только сегодня', cta: 'ПОЛУЧИТЬ ПРЕДЛОЖЕНИЕ' },
      'ar': { badge: '⚡ عرض حصري اليوم فقط', title: 'تخفيضات كبرى ومميزة', desc: 'العرض صالح لليوم فقط', cta: 'احصل على العرض الآن' }
    };

    function updateCreative() {
      const now = new Date();
      const userLocale = navigator.language || 'en-US';
      const primaryLang = userLocale.split('-')[0].toLowerCase();
      const content = GREETINGS[primaryLang] || GREETINGS['en'];

      // Update Texts
      document.getElementById('promo-badge').textContent = content.badge;
      document.getElementById('greeting-title').textContent = content.title;
      document.getElementById('greeting-desc').textContent = content.desc;
      document.getElementById('cta-button').textContent = content.cta;

      // Update Date Display
      const dateOpts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      document.getElementById('date-display').textContent = new Intl.DateTimeFormat(userLocale, dateOpts).format(now);
      
      // Update Clock Display
      const pad = n => String(n).padStart(2, '0');
      document.getElementById('clock-display').textContent = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());

      // Update Inspector rows
      document.getElementById('nav-lang').textContent = userLocale;
      document.getElementById('month-name').textContent = new Intl.DateTimeFormat(userLocale, { month: 'long' }).format(now);
      document.getElementById('day-name').textContent = new Intl.DateTimeFormat(userLocale, { weekday: 'long' }).format(now);

      // Number / Currency Format demo
      try {
        const currencyMap = { 'en-US': 'USD', 'en-GB': 'GBP', 'ja-JP': 'JPY', 'fr-FR': 'EUR', 'de-DE': 'EUR', 'fil-PH': 'PHP', 'pt-BR': 'BRL', 'es-ES': 'EUR', 'es-MX': 'MXN', 'es-AR': 'ARS', 'es-LA': 'USD' };
        const curr = currencyMap[userLocale] || 'USD';
        document.getElementById('currency-display').textContent = new Intl.NumberFormat(userLocale, { style: 'currency', currency: curr }).format(1499.99);
      } catch(e) {
        document.getElementById('currency-display').textContent = '$1,499.99';
      }

      // Relative Time demo
      if (Intl.RelativeTimeFormat) {
        const rtf = new Intl.RelativeTimeFormat(userLocale, { numeric: 'auto' });
        document.getElementById('relative-time-display').textContent = rtf.format(0, 'day') + ' • ' + now.getFullYear();
      }
    }

    updateCreative();
    setInterval(updateCreative, 1000);
    window.addEventListener('mock-time-change', updateCreative);
  </script>
</body>
</html>`;

class DateManipulatorApp {
  constructor() {
    this.files = [];
    this.activeFileId = null;

    // Simulation State
    const now = new Date();
    this.state = {
      simDate: this.formatDateISO(now),
      simTime: this.formatTime(now),
      timeMode: 'tick', // 'tick' | 'freeze'
      locale: 'en-US',
      device: 'iphone16',
      orientation: 'portrait', // 'portrait' | 'landscape'
      zoom: 'fit',
      startTimeReal: Date.now()
    };

    // Cache DOM Elements
    this.dom = {
      dropzone: document.getElementById('dropzone'),
      fileInput: document.getElementById('file-input'),
      filesList: document.getElementById('files-list'),
      filesCount: document.getElementById('files-count'),
      loadSampleBtn: document.getElementById('load-sample-btn'),
      loadDemoBtn: document.getElementById('load-demo-btn'),
      emptyState: document.getElementById('empty-state'),
      emptyLoadSample: document.getElementById('empty-load-sample'),
      emptyLoadDemo: document.getElementById('empty-load-demo'),
      urlInput: document.getElementById('url-input'),
      btnLoadUrl: document.getElementById('btn-load-url'),
      urlImportForm: document.getElementById('url-import-form'),
      emptyUrlInput: document.getElementById('empty-url-input'),
      emptyUrlSubmit: document.getElementById('empty-url-submit'),

      // Top Toolbar Controls
      dateInput: document.getElementById('date-input'),
      timeInput: document.getElementById('time-input'),
      timeModeBtn: document.getElementById('time-mode-btn'),
      timeModeText: document.getElementById('time-mode-text'),
      timeModeIcon: document.getElementById('time-mode-icon'),
      langSelect: document.getElementById('lang-select'),
      deviceSelect: document.getElementById('device-select'),
      orientationBtn: document.getElementById('orientation-btn'),
      orientationText: document.getElementById('orientation-text'),
      zoomSelect: document.getElementById('zoom-select'),
      reloadBtn: document.getElementById('reload-btn'),
      resetNowBtn: document.getElementById('reset-now-btn'),
      chipToday: document.getElementById('chip-today'),
      quickChips: document.querySelectorAll('.chip-btn'),

      // Status Bar
      statusLiveTime: document.getElementById('status-live-time'),
      statusLiveLocale: document.getElementById('status-live-locale'),
      simPulseDot: document.getElementById('sim-pulse-dot'),

      // Canvas & Device
      canvasWrapper: document.getElementById('canvas-wrapper'),
      deviceWrapper: document.getElementById('device-wrapper'),
      deviceFrame: document.getElementById('device-frame'),
      screenContainer: document.getElementById('screen-container'),
      dynamicIsland: document.getElementById('dynamic-island'),
      homeIndicator: document.getElementById('home-indicator'),
      previewIframe: document.getElementById('preview-iframe')
    };

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.syncInputsFromState();
    this.startLiveTicker();

    // Auto load workspace sample.html or interactive demo
    this.loadWorkspaceSample(false);

    // Initial resize calculation
    window.addEventListener('resize', () => this.applyDeviceDimensions());
  }

  // Helper date formatting
  formatDateISO(d) {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  formatTime(d) {
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  getSimulatedEpoch() {
    const [year, month, day] = this.state.simDate.split('-').map(Number);
    const [hours, minutes, seconds] = this.state.simTime.split(':').map(Number);
    const d = new Date(year, month - 1, day, hours || 0, minutes || 0, seconds || 0, 0);
    return d.getTime();
  }

  setupEventListeners() {
    // Dropzone & File Input
    this.dom.dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.dom.dropzone.classList.add('dragover');
    });

    this.dom.dropzone.addEventListener('dragleave', () => {
      this.dom.dropzone.classList.remove('dragover');
    });

    this.dom.dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.dom.dropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        this.handleFiles(Array.from(e.dataTransfer.files));
      }
    });

    this.dom.fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        this.handleFiles(Array.from(e.target.files));
      }
    });

    // Sample Loaders
    this.dom.loadSampleBtn.addEventListener('click', () => this.loadWorkspaceSample(true));
    this.dom.loadDemoBtn.addEventListener('click', () => this.loadDemoTemplate());
    this.dom.emptyLoadSample.addEventListener('click', () => this.loadWorkspaceSample(true));
    this.dom.emptyLoadDemo.addEventListener('click', () => this.loadDemoTemplate());

    // URL Loaders
    if (this.dom.urlImportForm) {
      this.dom.urlImportForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleUrlSubmit(this.dom.urlInput ? this.dom.urlInput.value : '');
      });
    }
    if (this.dom.btnLoadUrl) {
      this.dom.btnLoadUrl.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleUrlSubmit(this.dom.urlInput ? this.dom.urlInput.value : '');
      });
    }
    if (this.dom.emptyUrlSubmit) {
      this.dom.emptyUrlSubmit.addEventListener('click', () => {
        this.handleUrlSubmit(this.dom.emptyUrlInput ? this.dom.emptyUrlInput.value : '');
      });
    }
    if (this.dom.emptyUrlInput) {
      this.dom.emptyUrlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleUrlSubmit(this.dom.emptyUrlInput.value);
        }
      });
    }

    // Date Input Change
    this.dom.dateInput.addEventListener('input', (e) => {
      this.state.simDate = e.target.value;
      this.state.startTimeReal = Date.now();
      this.renderActiveFile();
      this.updateQuickChipsState();
    });

    // Quick Date Chips
    this.dom.quickChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const days = chip.getAttribute('data-days');
        const preset = chip.getAttribute('data-preset');
        const targetDate = new Date();

        if (days !== null) {
          targetDate.setDate(targetDate.getDate() + Number(days));
        } else if (preset === 'month-end') {
          targetDate.setMonth(targetDate.getMonth() + 1, 0);
        }

        this.state.simDate = this.formatDateISO(targetDate);
        this.state.startTimeReal = Date.now();
        this.dom.dateInput.value = this.state.simDate;
        this.renderActiveFile();
        this.updateQuickChipsState();
      });
    });

    // Time Input Change
    this.dom.timeInput.addEventListener('input', (e) => {
      this.state.simTime = e.target.value;
      this.state.startTimeReal = Date.now();
      this.renderActiveFile();
    });

    // Time Mode Button Toggle
    this.dom.timeModeBtn.addEventListener('click', () => {
      this.state.timeMode = this.state.timeMode === 'tick' ? 'freeze' : 'tick';
      this.state.startTimeReal = Date.now();
      this.updateTimeModeUI();
      this.renderActiveFile();
    });

    // Language Select Change
    this.dom.langSelect.addEventListener('change', (e) => {
      this.state.locale = e.target.value;
      this.renderActiveFile();
    });

    // Device Select Change
    this.dom.deviceSelect.addEventListener('change', (e) => {
      this.state.device = e.target.value;
      this.applyDeviceDimensions();
      this.renderActiveFile();
    });

    // Orientation Toggle Button
    this.dom.orientationBtn.addEventListener('click', () => {
      this.toggleOrientation();
    });

    // Zoom Select Change
    this.dom.zoomSelect.addEventListener('change', (e) => {
      this.state.zoom = e.target.value;
      this.applyDeviceDimensions();
    });

    // Reload Button
    this.dom.reloadBtn.addEventListener('click', () => {
      this.state.startTimeReal = Date.now();
      const activeFile = this.files.find(f => f.id === this.activeFileId);
      if (activeFile && activeFile.isDirectUrl) {
        const currentSrc = this.dom.previewIframe.src;
        this.dom.previewIframe.src = 'about:blank';
        setTimeout(() => { this.dom.previewIframe.src = currentSrc; }, 50);
      } else {
        this.renderActiveFile();
      }
      this.showToast('Preview refreshed');
    });

    // Reset Now Button
    this.dom.resetNowBtn.addEventListener('click', () => {
      const now = new Date();
      this.state.simDate = this.formatDateISO(now);
      this.state.simTime = this.formatTime(now);
      this.state.startTimeReal = Date.now();
      this.syncInputsFromState();
      this.renderActiveFile();
      this.showToast('Reset to current system date & time');
    });

    // Keyboard shortcut (R for rotate)
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        this.toggleOrientation();
      }
    });
  }

  toggleOrientation() {
    this.state.orientation = this.state.orientation === 'portrait' ? 'landscape' : 'portrait';
    this.updateOrientationUI();
    this.applyDeviceDimensions();
    this.renderActiveFile();
  }

  updateOrientationUI() {
    const isLand = this.state.orientation === 'landscape';
    this.dom.orientationBtn.classList.toggle('landscape', isLand);
    this.dom.orientationText.textContent = isLand ? 'Landscape' : 'Portrait';
  }

  updateTimeModeUI() {
    const isFreeze = this.state.timeMode === 'freeze';
    this.dom.timeModeText.textContent = isFreeze ? 'Frozen' : 'Live Ticking';
    this.dom.timeModeIcon.textContent = isFreeze ? '❄️' : '⏳';
    this.dom.simPulseDot.classList.toggle('frozen', isFreeze);
  }

  updateQuickChipsState() {
    const todayISO = this.formatDateISO(new Date());
    this.dom.quickChips.forEach(chip => {
      const days = chip.getAttribute('data-days');
      if (days === '0') {
        chip.classList.toggle('active', this.state.simDate === todayISO);
      } else {
        chip.classList.remove('active');
      }
    });
  }

  syncInputsFromState() {
    this.dom.dateInput.value = this.state.simDate;
    this.dom.timeInput.value = this.state.simTime;
    this.dom.langSelect.value = this.state.locale;
    this.dom.deviceSelect.value = this.state.device;
    this.updateOrientationUI();
    this.updateTimeModeUI();
    this.updateQuickChipsState();
  }

  // Helper to read file as text safely across environments
  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      if (typeof file.text === 'function') {
        file.text().then(resolve).catch(err => {
          // Fallback to FileReader if file.text() fails
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = reject;
          reader.readAsText(file);
        });
      } else {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
      }
    });
  }

  async handleUrlSubmit(rawUrl) {
    if (!rawUrl || !rawUrl.trim()) {
      this.showToast('Please enter a valid URL');
      return;
    }

    let url = rawUrl.trim();
    if (!/^https?:\/\//i.test(url) && !url.startsWith('./') && !url.startsWith('/') && !url.startsWith('file:')) {
      if (/^localhost(:\d+)?/i.test(url) || /^127\.0\.0\.1(:\d+)?/.test(url)) {
        url = 'http://' + url;
      } else {
        url = 'https://' + url;
      }
    }

    const submitBtns = [this.dom.btnLoadUrl, this.dom.emptyUrlSubmit].filter(Boolean);
    submitBtns.forEach(btn => {
      btn.disabled = true;
      btn.dataset.origHtml = btn.innerHTML;
      btn.innerHTML = '⏳';
    });

    this.showToast('Loading URL...');

    try {
      let fetchedHtml = null;
      try {
        const resp = await fetch(url);
        if (resp.ok) {
          fetchedHtml = await resp.text();
        }
      } catch (corsErr) {
        console.warn('Direct fetch blocked by CORS, loading directly into device frame:', corsErr);
      }

      let parsedName;
      try {
        const parsed = new URL(url);
        parsedName = parsed.pathname.split('/').filter(Boolean).pop() || parsed.hostname;
      } catch (_) {
        parsedName = url.split('/').pop().split('?')[0] || url;
      }

      if (fetchedHtml) {
        const displayName = parsedName.endsWith('.html') || parsedName.endsWith('.htm') ? parsedName : `${parsedName}.html`;
        const urlFile = {
          id: 'url_' + Date.now(),
          name: displayName,
          fullUrl: url,
          size: this.formatBytes(fetchedHtml.length),
          rawHtml: fetchedHtml,
          isSample: false,
          isUrl: true,
          isDirectUrl: false
        };

        this.files.unshift(urlFile);
        this.activeFileId = urlFile.id;
        this.renderFilesList();
        this.renderActiveFile();
        this.showToast(`Loaded & simulated: ${displayName}`);
      } else {
        const urlFile = {
          id: 'url_' + Date.now(),
          name: parsedName || url,
          fullUrl: url,
          size: 'Remote URL',
          rawHtml: '',
          isSample: false,
          isUrl: true,
          isDirectUrl: true
        };

        this.files.unshift(urlFile);
        this.activeFileId = urlFile.id;
        this.renderFilesList();
        this.renderActiveFile();
        this.showToast('Loaded in device frame (direct URL)');
      }

      if (this.dom.urlInput) this.dom.urlInput.value = '';
      if (this.dom.emptyUrlInput) this.dom.emptyUrlInput.value = '';
    } catch (err) {
      console.error('Failed to load URL:', err);
      this.showToast('Failed to load URL: ' + err.message);
    } finally {
      submitBtns.forEach(btn => {
        btn.disabled = false;
        if (btn.dataset.origHtml) btn.innerHTML = btn.dataset.origHtml;
      });
    }
  }

  // Handle uploaded files
  async handleFiles(fileList) {
    const validFiles = fileList.filter(f => f.name.endsWith('.html') || f.name.endsWith('.htm'));
    if (validFiles.length === 0) {
      this.showToast('Please upload .html or .htm files');
      return;
    }

    for (const file of validFiles) {
      try {
        const content = await this.readFileAsText(file);
        const newFile = {
          id: 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          name: file.name,
          size: this.formatBytes(file.size),
          rawHtml: content,
          isSample: false
        };
        this.files.unshift(newFile);
        this.activeFileId = newFile.id;
      } catch (err) {
        console.error('Error reading file:', err);
        this.showToast('Error reading ' + file.name);
      }
    }

    this.renderFilesList();
    this.renderActiveFile();
    this.showToast(`Imported ${validFiles.length} HTML file(s)`);
  }

  // Load sample.html from workspace
  async loadWorkspaceSample(showNotification = true) {
    try {
      const resp = await fetch('./sample.html');
      if (!resp.ok) throw new Error('File not found');
      const text = await resp.ok ? await resp.text() : '';

      const sampleFile = {
        id: 'workspace_sample',
        name: 'sample.html (SIP Creative)',
        size: this.formatBytes(text.length),
        rawHtml: text,
        isSample: true
      };

      // Add to files if not existing
      const existingIdx = this.files.findIndex(f => f.id === 'workspace_sample');
      if (existingIdx >= 0) {
        this.files[existingIdx] = sampleFile;
      } else {
        this.files.push(sampleFile);
      }

      this.activeFileId = 'workspace_sample';
      this.renderFilesList();
      this.renderActiveFile();
      if (showNotification) this.showToast('Workspace sample.html loaded');
    } catch (err) {
      console.warn('Could not auto-load workspace sample.html, loading demo banner instead:', err);
      this.loadDemoTemplate();
    }
  }

  // Load Built-in Demo Template
  loadDemoTemplate() {
    const demoFile = {
      id: 'demo_template',
      name: 'Interactive_Demo_Creative.html',
      size: this.formatBytes(DEMO_TEMPLATE_HTML.length),
      rawHtml: DEMO_TEMPLATE_HTML,
      isSample: true
    };

    const existingIdx = this.files.findIndex(f => f.id === 'demo_template');
    if (existingIdx >= 0) {
      this.files[existingIdx] = demoFile;
    } else {
      this.files.unshift(demoFile);
    }

    this.activeFileId = 'demo_template';
    this.renderFilesList();
    this.renderActiveFile();
    this.showToast('Loaded interactive multilingual demo');
  }

  renderFilesList() {
    this.dom.filesCount.textContent = `${this.files.length} file${this.files.length === 1 ? '' : 's'}`;
    this.dom.filesList.innerHTML = '';

    if (this.files.length === 0) {
      this.dom.emptyState.style.display = 'flex';
      return;
    }

    this.dom.emptyState.style.display = 'none';

    this.files.forEach(file => {
      const item = document.createElement('div');
      item.className = `file-item ${file.id === this.activeFileId ? 'active' : ''}`;
      const icon = file.isUrl ? '🌐' : '📄';
      const fileTitle = file.fullUrl ? `${file.name}\n${file.fullUrl}` : file.name;
      item.innerHTML = `
        <div class="file-item-left">
          <div class="file-item-icon">${icon}</div>
          <div class="file-item-meta">
            <span class="file-item-name" title="${fileTitle}">${file.name}</span>
            <span class="file-item-size">${file.size}</span>
          </div>
        </div>
        <div class="file-item-actions">
          <button class="file-action-btn delete-btn" title="Remove" data-id="${file.id}">✕</button>
        </div>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) {
          e.stopPropagation();
          this.removeFile(file.id);
          return;
        }
        this.activeFileId = file.id;
        this.renderFilesList();
        this.renderActiveFile();
      });

      this.dom.filesList.appendChild(item);
    });
  }

  removeFile(fileId) {
    this.files = this.files.filter(f => f.id !== fileId);
    if (this.activeFileId === fileId) {
      this.activeFileId = this.files.length > 0 ? this.files[0].id : null;
    }
    this.renderFilesList();
    this.renderActiveFile();
  }

  // Prepare and inject simulated script into HTML
  buildInjectedHtml(rawHtml) {
    const targetEpoch = this.getSimulatedEpoch();
    const startTimeReal = this.state.startTimeReal || Date.now();

    const simulatorScript = `
<script>
// Simulator Injection Header
window.__SIMULATOR_CONFIG__ = {
  targetEpoch: ${targetEpoch},
  startTimeReal: ${startTimeReal},
  mode: '${this.state.timeMode}',
  locale: '${this.state.locale}'
};

(function() {
  const config = window.__SIMULATOR_CONFIG__;
  const OriginalDate = window.Date;
  const originalNow = OriginalDate.now;

  function calculateCurrentSimulatedTime() {
    if (!config.targetEpoch) return originalNow.call(OriginalDate);
    if (config.mode === 'freeze') {
      return config.targetEpoch;
    }
    const elapsedReal = originalNow.call(OriginalDate) - (config.startTimeReal || originalNow.call(OriginalDate));
    return config.targetEpoch + elapsedReal;
  }

  function SimulatedDate(...args) {
    if (!(this instanceof SimulatedDate)) {
      return (new SimulatedDate()).toString();
    }
    if (args.length === 0) {
      return new OriginalDate(calculateCurrentSimulatedTime());
    }
    return new OriginalDate(...args);
  }

  SimulatedDate.prototype = OriginalDate.prototype;
  SimulatedDate.now = function() { return calculateCurrentSimulatedTime(); };
  SimulatedDate.parse = OriginalDate.parse;
  SimulatedDate.UTC = OriginalDate.UTC;
  window.Date = SimulatedDate;

  try {
    const lang = config.locale || 'en-US';
    Object.defineProperty(navigator, 'language', { get: () => config.locale || 'en-US', configurable: true });
    Object.defineProperty(navigator, 'languages', { get: () => [config.locale || 'en-US', (config.locale || 'en-US').split('-')[0], 'en'], configurable: true });
    Object.defineProperty(navigator, 'userLanguage', { get: () => config.locale || 'en-US', configurable: true });
    Object.defineProperty(navigator, 'browserLanguage', { get: () => config.locale || 'en-US', configurable: true });
  } catch(e) {}

  if (window.Intl) {
    const OrigDateTimeFormat = Intl.DateTimeFormat;
    Intl.DateTimeFormat = function(locales, options) {
      return new OrigDateTimeFormat(locales || config.locale || 'en-US', options);
    };
    Intl.DateTimeFormat.prototype = OrigDateTimeFormat.prototype;
    Intl.DateTimeFormat.supportedLocalesOf = OrigDateTimeFormat.supportedLocalesOf;

    if (Intl.NumberFormat) {
      const OrigNumberFormat = Intl.NumberFormat;
      Intl.NumberFormat = function(locales, options) {
        return new OrigNumberFormat(locales || config.locale || 'en-US', options);
      };
      Intl.NumberFormat.prototype = OrigNumberFormat.prototype;
      Intl.NumberFormat.supportedLocalesOf = OrigNumberFormat.supportedLocalesOf;
    }

    if (Intl.RelativeTimeFormat) {
      const OrigRelativeTimeFormat = Intl.RelativeTimeFormat;
      Intl.RelativeTimeFormat = function(locales, options) {
        return new OrigRelativeTimeFormat(locales || config.locale || 'en-US', options);
      };
      Intl.RelativeTimeFormat.prototype = OrigRelativeTimeFormat.prototype;
      Intl.RelativeTimeFormat.supportedLocalesOf = OrigRelativeTimeFormat.supportedLocalesOf;
    }
  }

  // MRAID Mock Bridge
  if (typeof window.mraid === 'undefined') {
    const mraidListeners = {};
    window.mraid = {
      getState: () => 'default',
      getVersion: () => '2.0',
      isViewable: () => true,
      addEventListener: (evt, fn) => {
        if (!mraidListeners[evt]) mraidListeners[evt] = [];
        mraidListeners[evt].push(fn);
      },
      removeEventListener: (evt, fn) => {
        if (!mraidListeners[evt]) return;
        mraidListeners[evt] = mraidListeners[evt].filter(l => l !== fn);
      },
      open: (url) => { window.open(url, '_blank'); },
      close: () => {},
      expand: () => {},
      useCustomClose: () => {},
      setOrientationProperties: () => {},
      getPlacementType: () => 'inline'
    };
  }

  function syncDomAndTemplate() {
    try {
      if (document.documentElement) {
        document.documentElement.lang = config.locale || 'en-US';
      }
      if (typeof window.dateLocale !== 'undefined') {
        window.dateLocale = config.locale || 'en-US';
      }
      const sipConfigScript = document.getElementById('sip-builder-config');
      if (sipConfigScript && sipConfigScript.textContent) {
        try {
          const cfg = JSON.parse(sipConfigScript.textContent);
          if (cfg.dateFormat) cfg.dateFormat.locale = config.locale || 'en-US';
          if (Array.isArray(cfg.customTexts)) {
            cfg.customTexts.forEach(ct => { if (ct.dateFormat) ct.dateFormat.locale = config.locale || 'en-US'; });
          }
          sipConfigScript.textContent = JSON.stringify(cfg);
        } catch(e) {}
      }
      if (typeof window.renderSipDate === 'function') window.renderSipDate();
      if (typeof window.updateDynamicDatePosition === 'function') window.updateDynamicDatePosition();
    } catch(e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncDomAndTemplate);
  } else {
    syncDomAndTemplate();
  }

  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === '__SIMULATOR_UPDATE__') {
      const p = event.data.payload;
      if (p.targetEpoch) config.targetEpoch = p.targetEpoch;
      if (p.startTimeReal) config.startTimeReal = p.startTimeReal;
      if (p.mode) config.mode = p.mode;
      if (p.locale) config.locale = p.locale;
      syncDomAndTemplate();
      window.dispatchEvent(new CustomEvent('mock-time-change', { detail: { date: new Date(), locale: config.locale } }));
    }
  });
})();
</script>
`;

    // Process rawHtml: Inject right after <head> or at top
    let outputHtml = rawHtml;
    
    // Also patch SIP template hardcoded "dateLocale" if present in raw string
    outputHtml = outputHtml.replace(/const\s+dateLocale\s*=\s*"[^"]*";/g, `const dateLocale = "${this.state.locale}";`);
    outputHtml = outputHtml.replace(/var\s+dateLocale\s*=\s*"[^"]*";/g, `var dateLocale = "${this.state.locale}";`);
    outputHtml = outputHtml.replace(/let\s+dateLocale\s*=\s*"[^"]*";/g, `let dateLocale = "${this.state.locale}";`);

    if (outputHtml.includes('<head>')) {
      outputHtml = outputHtml.replace('<head>', '<head>' + simulatorScript);
    } else if (outputHtml.includes('<html>')) {
      outputHtml = outputHtml.replace('<html>', '<html><head>' + simulatorScript + '</head>');
    } else {
      outputHtml = simulatorScript + outputHtml;
    }

    return outputHtml;
  }

  // Render active file into iframe
  renderActiveFile() {
    const activeFile = this.files.find(f => f.id === this.activeFileId);
    if (!activeFile) {
      this.dom.emptyState.style.display = 'flex';
      return;
    }

    this.dom.emptyState.style.display = 'none';

    if (activeFile.isDirectUrl) {
      this.dom.previewIframe.removeAttribute('srcdoc');
      this.dom.previewIframe.src = activeFile.fullUrl;
    } else {
      this.dom.previewIframe.removeAttribute('src');
      const processedHtml = this.buildInjectedHtml(activeFile.rawHtml);
      this.dom.previewIframe.srcdoc = processedHtml;
    }

    this.updateStatusDisplay();
  }

  // Live status bar and clock update
  updateStatusDisplay() {
    const targetEpoch = this.getSimulatedEpoch();
    let currentSimEpoch = targetEpoch;

    if (this.state.timeMode === 'tick') {
      const elapsed = Date.now() - (this.state.startTimeReal || Date.now());
      currentSimEpoch = targetEpoch + elapsed;
    }

    const simDateObj = new Date(currentSimEpoch);
    const timeFormatted = simDateObj.toLocaleTimeString('en-US', { hour12: false });
    const dateFormatted = simDateObj.toLocaleDateString(this.state.locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    this.dom.statusLiveTime.textContent = `${dateFormatted} ${timeFormatted}`;
    this.dom.statusLiveLocale.textContent = this.state.locale;
  }

  startLiveTicker() {
    setInterval(() => {
      this.updateStatusDisplay();
    }, 1000);
  }

  // Apply device dimensions and responsive zoom
  applyDeviceDimensions() {
    const cfg = DEVICE_CONFIGS[this.state.device] || DEVICE_CONFIGS.iphone16;
    const isLandscape = this.state.orientation === 'landscape';

    const frameW = isLandscape ? cfg.height : cfg.width;
    const frameH = isLandscape ? cfg.width : cfg.height;

    // Apply frame class
    this.dom.deviceFrame.className = `device-frame ${cfg.type}-style ${isLandscape ? 'landscape' : 'portrait'}`;
    this.dom.deviceFrame.style.width = `${frameW}px`;
    this.dom.deviceFrame.style.height = `${frameH}px`;
    this.dom.deviceFrame.style.borderRadius = cfg.borderRadius;
    this.dom.screenContainer.style.borderRadius = cfg.screenRadius;

    // Dynamic island visibility
    this.dom.dynamicIsland.style.display = (cfg.hasIsland && !isLandscape) ? 'flex' : 'none';

    // Calculate auto zoom
    this.calculateViewportScale(frameW, frameH);
  }

  calculateViewportScale(frameW, frameH) {
    if (this.state.zoom !== 'fit') {
      const scaleVal = parseFloat(this.state.zoom) || 1;
      this.dom.deviceWrapper.style.transform = `scale(${scaleVal})`;
      return;
    }

    const canvasW = this.dom.canvasWrapper.clientWidth - 48;
    const canvasH = this.dom.canvasWrapper.clientHeight - 48;

    if (canvasW <= 0 || canvasH <= 0) return;

    // Outer bezel cushion (~32px total bezel padding)
    const totalW = frameW + 32;
    const totalH = frameH + 32;

    const scaleX = canvasW / totalW;
    const scaleY = canvasH / totalH;
    const scale = Math.min(1, Math.min(scaleX, scaleY));

    this.dom.deviceWrapper.style.transform = `scale(${scale.toFixed(3)})`;
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  showToast(message) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>✓</span><span>${message}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.2s';
      setTimeout(() => toast.remove(), 200);
    }, 2500);
  }
}

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new DateManipulatorApp();
});
