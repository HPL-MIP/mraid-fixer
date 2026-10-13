/**
 * Dynamic Date, Time & Language Simulator Injector Engine
 * Injected at the top of imported HTML documents in sandboxed iframes.
 */
(function() {
  // Global config storage on window
  window.__SIMULATOR_CONFIG__ = window.__SIMULATOR_CONFIG__ || {
    date: null,
    time: '12:00:00',
    mode: 'tick', // 'tick' | 'freeze'
    locale: 'en-US',
    startTimeReal: Date.now(),
    targetEpoch: Date.now()
  };

  const config = window.__SIMULATOR_CONFIG__;
  const OriginalDate = window.Date;
  const originalNow = OriginalDate.now;

  function calculateCurrentSimulatedTime() {
    if (!config.targetEpoch) return originalNow.call(OriginalDate);
    if (config.mode === 'freeze') {
      return config.targetEpoch;
    }
    // Tick mode: advance 1 second per real second elapsed
    const elapsedReal = originalNow.call(OriginalDate) - (config.startTimeReal || originalNow.call(OriginalDate));
    return config.targetEpoch + elapsedReal;
  }

  // --- 1. Override window.Date ---
  function SimulatedDate(...args) {
    if (!(this instanceof SimulatedDate)) {
      return (new SimulatedDate()).toString();
    }
    if (args.length === 0) {
      return new OriginalDate(calculateCurrentSimulatedTime());
    }
    // @ts-ignore
    return new OriginalDate(...args);
  }

  SimulatedDate.prototype = OriginalDate.prototype;
  SimulatedDate.now = function() {
    return calculateCurrentSimulatedTime();
  };
  SimulatedDate.parse = OriginalDate.parse;
  SimulatedDate.UTC = OriginalDate.UTC;
  window.Date = SimulatedDate;

  // --- 2. Override navigator.language and navigator.languages ---
  try {
    const lang = config.locale || 'en-US';
    const primaryLang = lang.split('-')[0];

    Object.defineProperty(navigator, 'language', {
      get: function() { return config.locale || 'en-US'; },
      configurable: true,
      enumerable: true
    });

    Object.defineProperty(navigator, 'languages', {
      get: function() { return [config.locale || 'en-US', (config.locale || 'en-US').split('-')[0], 'en']; },
      configurable: true,
      enumerable: true
    });

    Object.defineProperty(navigator, 'userLanguage', {
      get: function() { return config.locale || 'en-US'; },
      configurable: true,
      enumerable: true
    });

    Object.defineProperty(navigator, 'browserLanguage', {
      get: function() { return config.locale || 'en-US'; },
      configurable: true,
      enumerable: true
    });
  } catch (e) {
    console.warn('[Simulator] Could not override navigator properties:', e);
  }

  // --- 3. Override Intl API default locale ---
  if (window.Intl) {
    const OrigDateTimeFormat = Intl.DateTimeFormat;
    Intl.DateTimeFormat = function(locales, options) {
      const effectiveLocale = locales || config.locale || 'en-US';
      return new OrigDateTimeFormat(effectiveLocale, options);
    };
    Intl.DateTimeFormat.prototype = OrigDateTimeFormat.prototype;
    Intl.DateTimeFormat.supportedLocalesOf = OrigDateTimeFormat.supportedLocalesOf;

    if (Intl.NumberFormat) {
      const OrigNumberFormat = Intl.NumberFormat;
      Intl.NumberFormat = function(locales, options) {
        const effectiveLocale = locales || config.locale || 'en-US';
        return new OrigNumberFormat(effectiveLocale, options);
      };
      Intl.NumberFormat.prototype = OrigNumberFormat.prototype;
      Intl.NumberFormat.supportedLocalesOf = OrigNumberFormat.supportedLocalesOf;
    }

    if (Intl.RelativeTimeFormat) {
      const OrigRelativeTimeFormat = Intl.RelativeTimeFormat;
      Intl.RelativeTimeFormat = function(locales, options) {
        const effectiveLocale = locales || config.locale || 'en-US';
        return new OrigRelativeTimeFormat(effectiveLocale, options);
      };
      Intl.RelativeTimeFormat.prototype = OrigRelativeTimeFormat.prototype;
      Intl.RelativeTimeFormat.supportedLocalesOf = OrigRelativeTimeFormat.supportedLocalesOf;
    }
  }

  // --- 4. Provide MRAID Mock Bridge ---
  if (typeof window.mraid === 'undefined') {
    const mraidListeners = {};
    window.mraid = {
      getState: function() { return 'default'; },
      getVersion: function() { return '2.0'; },
      isViewable: function() { return true; },
      addEventListener: function(event, listener) {
        if (!mraidListeners[event]) mraidListeners[event] = [];
        mraidListeners[event].push(listener);
      },
      removeEventListener: function(event, listener) {
        if (!mraidListeners[event]) return;
        mraidListeners[event] = mraidListeners[event].filter(l => l !== listener);
      },
      open: function(url) {
        console.log('[MRAID Mock] Clicked through to:', url);
        window.open(url, '_blank');
      },
      close: function() { console.log('[MRAID Mock] Closed'); },
      expand: function() { console.log('[MRAID Mock] Expanded'); },
      useCustomClose: function() {},
      setOrientationProperties: function() {},
      getPlacementType: function() { return 'inline'; },
      triggerReady: function() {
        if (mraidListeners['ready']) {
          mraidListeners['ready'].forEach(fn => {
            try { fn(); } catch(e) { console.error(e); }
          });
        }
      }
    };
  }

  // --- 5. DOM & SIP Template Dynamic Sync ---
  function syncDomAndTemplate() {
    try {
      if (document.documentElement) {
        document.documentElement.lang = config.locale || 'en-US';
      }
      // Check for SIP template globals & configs
      if (typeof window.dateLocale !== 'undefined') {
        window.dateLocale = config.locale || 'en-US';
      }
      const sipConfigScript = document.getElementById('sip-builder-config');
      if (sipConfigScript && sipConfigScript.textContent) {
        try {
          const cfg = JSON.parse(sipConfigScript.textContent);
          if (cfg.dateFormat) {
            cfg.dateFormat.locale = config.locale || 'en-US';
          }
          if (Array.isArray(cfg.customTexts)) {
            cfg.customTexts.forEach(ct => {
              if (ct.dateFormat) ct.dateFormat.locale = config.locale || 'en-US';
            });
          }
          sipConfigScript.textContent = JSON.stringify(cfg);
        } catch (err) {}
      }

      // Re-trigger renderSipDate if present
      if (typeof window.renderSipDate === 'function') {
        window.renderSipDate();
      }
      if (typeof window.updateDynamicDatePosition === 'function') {
        window.updateDynamicDatePosition();
      }
    } catch (e) {
      console.warn('[Simulator] DOM sync error:', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncDomAndTemplate);
  } else {
    syncDomAndTemplate();
  }

  // --- 6. Listen for parent frame live updates ---
  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === '__SIMULATOR_UPDATE__') {
      const payload = event.data.payload;
      if (payload.targetEpoch) config.targetEpoch = payload.targetEpoch;
      if (payload.startTimeReal) config.startTimeReal = payload.startTimeReal;
      if (payload.mode) config.mode = payload.mode;
      if (payload.locale) config.locale = payload.locale;

      syncDomAndTemplate();

      window.dispatchEvent(new CustomEvent('mock-time-change', {
        detail: {
          simulatedDate: new Date(),
          locale: config.locale
        }
      }));
    }
  });

  console.log('[Simulator Engine Active] Initialized with:', {
    simulatedTime: (new Date()).toLocaleString(config.locale || 'en-US'),
    locale: config.locale,
    mode: config.mode
  });
})();
