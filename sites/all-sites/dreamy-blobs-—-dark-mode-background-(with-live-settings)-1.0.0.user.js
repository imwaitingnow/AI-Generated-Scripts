// ==UserScript==
// @name         Dreamy Blobs — Dark-Mode Background (with Live Settings)
// @namespace    dreamy.blobs.darkmode
// @version      1.0.0
// @description  Turn any page into a dreamy, animated dark-mode canvas with floating blobs. Live settings via Tampermonkey menu. Presets, Random Magic, Reset, and persistence.
// @author       skyline/imwaitingnow
// @match        *://*/*
// @run-at       document-idle
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @noframes
// ==/UserScript==

(() => {
  'use strict';

  // -----------------------------
  // Utilities
  // -----------------------------
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const rand = (min, max) => Math.random() * (max - min) + min;
  const randInt = (min, max) => Math.floor(rand(min, max + 1));
  const rgb = (r, g, b, a = 1) => `rgba(${r|0},${g|0},${b|0},${a})`;
  const hex = (r, g, b) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  const parseHex = (h) => {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0];
  };

  // -----------------------------
  // Presets (dark-leaning)
  // -----------------------------
  const PRESETS = {
    'Night Sky':      { bg:[11,16,38],   primary:[30,42,120],  secondary:[108,43,143], accent:[166,107,255] },
    'Midnight Forest':{ bg:[10,26,18],   primary:[15,61,46],   secondary:[27,94,59],   accent:[128,209,166] },
    'Cosmic Dream':   { bg:[8,18,41],    primary:[27,43,114],  secondary:[142,46,169], accent:[255,102,204] },
    'Deep Ocean':     { bg:[6,20,31],    primary:[11,60,93],   secondary:[50,130,184], accent:[187,225,250] },
    'Neon Noir':      { bg:[11,11,16],   primary:[31,31,46],   secondary:[58,12,163],  accent:[247,37,133] }
  };

  // -----------------------------
  // Defaults
  // -----------------------------
  const DEFAULTS = {
    themeName: 'random', // use random colors on first install
    colors: { // will be filled on first run if random
      bg: [10, 12, 18],
      primary: [40, 80, 200],
      secondary: [120, 60, 200],
      accent: [255, 100, 200],
    },
    blobs: {
      count: 14,          // 10–20
      sizeScale: 1.0,     // 0.5–2.0
      speed: 0.3          // 0.1–1.0 (slow & dreamy)
    },
    enabled: true,
    version: 1
  };

  const STORAGE_KEY = 'dreamy_blobs_prefs_v1';

  const randomColor = () => [randInt(0,255), randInt(0,255), randInt(0,255)];
  const randomDarkish = () => {
    // Bias towards darker bg but allow variety
    const v = randInt(0, 80);
    return [v, v + randInt(0, 30), v + randInt(0, 30)];
  };

  // -----------------------------
  // State
  // -----------------------------
  let prefs = null;
  let menuIds = [];
  let animator = null;
  let canvas, ctx, overlay, dpi = window.devicePixelRatio || 1;
  let blobs = [];
  let lastTime = 0;
  let running = false;

  // -----------------------------
  // Storage
  // -----------------------------
  async function loadPrefs() {
    const stored = await GM_getValue(STORAGE_KEY, null);
    if (stored) {
      prefs = stored;
    } else {
      // First install: random theme by default
      prefs = structuredClone(DEFAULTS);
      prefs.colors = {
        bg: randomDarkish(),
        primary: randomColor(),
        secondary: randomColor(),
        accent: randomColor()
      };
      await savePrefs();
    }
    clampPrefs();
  }

  function clampPrefs() {
    const b = prefs.blobs;
    b.count = clamp(b.count | 0, 10, 20);
    b.sizeScale = clamp(+b.sizeScale || 1, 0.5, 2.0);
    b.speed = clamp(+b.speed || 0.3, 0.05, 2.0);
  }

  async function savePrefs() {
    clampPrefs();
    await GM_setValue(STORAGE_KEY, prefs);
  }

  // -----------------------------
  // UI: Styles
  // -----------------------------
  GM_addStyle(`
    #dreamy-blobs-overlay {
      position: fixed;
      inset: 0;
      pointer-events: none; /* don't block the page */
      z-index: 2147483646;  /* above everything, but transparent */
      contain: strict;
    }
    #dreamy-blobs-overlay canvas {
      width: 100%;
      height: 100%;
      display: block;
    }

    /* Settings panel (opened via TM popup -> "Open Dreamy Settings") */
    .db-panel {
      position: fixed;
      top: 24px; right: 24px;
      width: 360px;
      max-width: calc(100vw - 48px);
      background: #101318ee;
      backdrop-filter: blur(8px);
      color: #e6e6f0;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial;
      border: 1px solid #2a2f3a;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0,0,0,.4);
      z-index: 2147483647;
      pointer-events: auto;
    }
    .db-panel header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 14px; font-weight: 700; letter-spacing: .2px;
      border-bottom: 1px solid #232834;
    }
    .db-panel .db-body { padding: 12px 14px 14px; }
    .db-row { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; margin: 8px 0; }
    .db-label { font-size: 12px; text-transform: uppercase; opacity: .8; }
    .db-range { width: 100%; }
    .db-chip { padding: 2px 8px; font-size: 12px; border: 1px solid #2a2f3a; border-radius: 999px; background:#161b23; }
    .db-col { display:grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 6px; align-items:center; }
    .db-col input[type="range"] { width: 100%; }
    .db-col .db-swatch { width: 20px; height: 20px; border-radius: 6px; border:1px solid #2a2f3a; }
    .db-actions { display:flex; gap:8px; flex-wrap: wrap; margin-top: 10px; }
    .db-btn {
      appearance: none; border:1px solid #2a2f3a; background:#151a22; color:#e6e6f0;
      padding: 8px 10px; border-radius: 10px; cursor: pointer; font-size: 12px;
    }
    .db-btn:hover { filter: brightness(1.08); }
    .db-select { width:100%; background:#151a22; color:#e6e6f0; border:1px solid #2a2f3a; border-radius:8px; padding:6px; }
    .db-subtle { font-size: 11px; opacity: .7; margin-top: 2px; }
    .db-close { background: transparent; border: none; color: #ccc; font-size: 18px; cursor: pointer; }
    @media print { #dreamy-blobs-overlay { display: none !important; } .db-panel { display:none !important; } }
  `);

  // -----------------------------
  // Overlay + Animation
  // -----------------------------
  function ensureOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'dreamy-blobs-overlay';
    canvas = document.createElement('canvas');
    overlay.appendChild(canvas);
    document.documentElement.appendChild(overlay);
    ctx = canvas.getContext('2d');
    onResize();
    window.addEventListener('resize', onResize, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop();
      else if (prefs.enabled) start();
    });
  }

  function onResize() {
    const w = Math.floor(window.innerWidth * dpi);
    const h = Math.floor(window.innerHeight * dpi);
    canvas.width = w;
    canvas.height = h;
  }

  function makeBlob(w, h) {
    const maxR = Math.min(w, h) * 0.25 * prefs.blobs.sizeScale;
    const minR = Math.min(w, h) * 0.08 * prefs.blobs.sizeScale;
    const r = rand(minR, maxR);
    const speedBase = 12; // pixels per second at speed=1
    const vx = (Math.random() * 2 - 1) * speedBase * prefs.blobs.speed;
    const vy = (Math.random() * 2 - 1) * speedBase * prefs.blobs.speed;
    const choose = (arr) => arr[randInt(0, arr.length - 1)];
    const palette = [prefs.colors.primary, prefs.colors.secondary, prefs.colors.accent];
    const c1 = choose(palette), c2 = choose(palette);
    return {
      x: rand(r, w - r),
      y: rand(r, h - r),
      r,
      baseR: r,
      vx, vy,
      wiggleA: rand(0, Math.PI * 2),
      wiggleB: rand(0, Math.PI * 2),
      c1, c2,
      alpha: 0.35 + Math.random() * 0.2
    };
  }

  function rebuildBlobs() {
    const w = canvas.width, h = canvas.height;
    const target = prefs.blobs.count;
    if (blobs.length > target) {
      blobs = blobs.slice(0, target);
    } else {
      while (blobs.length < target) blobs.push(makeBlob(w, h));
    }
  }

  function tick(ts) {
    if (!running) return;
    if (!lastTime) lastTime = ts;
    const dt = Math.min(0.05, (ts - lastTime) / 1000); // seconds, clamp large jumps
    lastTime = ts;
    const w = canvas.width, h = canvas.height;

    // Background veil (soft, semi-transparent)
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = rgb(...prefs.colors.bg, 0.35);
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = 'lighter';

    for (const b of blobs) {
      // Dreamy motion: slow velocity + gentle sinusoidal wiggle
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      const t = ts / 1000;
      const wiggleR = 0.12 * b.baseR;
      const wr = b.baseR + Math.sin(t * 0.35 + b.wiggleA) * wiggleR + Math.cos(t * 0.21 + b.wiggleB) * (wiggleR * 0.6);
      b.r = clamp(wr, b.baseR * 0.7, b.baseR * 1.3);

      // Bounce softly at edges
      if (b.x < b.r) { b.x = b.r; b.vx *= -1; }
      if (b.x > w - b.r) { b.x = w - b.r; b.vx *= -1; }
      if (b.y < b.r) { b.y = b.r; b.vy *= -1; }
      if (b.y > h - b.r) { b.y = h - b.r; b.vy *= -1; }

      // Radial gradient blob
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      g.addColorStop(0, rgb(...b.c1, b.alpha));
      g.addColorStop(0.65, rgb(...b.c2, b.alpha * 0.55));
      g.addColorStop(1, rgb(...prefs.colors.bg, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    animator = requestAnimationFrame(tick);
  }

  function start() {
    if (running) return;
    running = true;
    lastTime = 0;
    animator = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    if (animator) cancelAnimationFrame(animator);
    animator = null;
  }

  function applyPrefs() {
    if (!prefs.enabled) { stop(); return; }
    ensureOverlay();
    onResize();
    rebuildBlobs();
    start();
  }

  // -----------------------------
  // Settings Panel
  // -----------------------------
  let panelEl = null;

  function sliderRow(label, keyPath) {
    // keyPath is like "colors.bg" or "blobs.count"
    const idBase = 'db-' + keyPath.replace(/\./g, '-');
    const value = keyPath.startsWith('colors.')
      ? prefs.colors[keyPath.split('.')[1]]
      : prefs.blobs[keyPath.split('.')[1]];

    if (keyPath.startsWith('colors.')) {
      const [r, g, b] = value;
      return `
      <div class="db-row">
        <div class="db-label">${label}</div>
        <div class="db-col" data-key="${keyPath}">
          <input type="range" min="0" max="255" value="${r}" class="db-range" id="${idBase}-r" />
          <input type="range" min="0" max="255" value="${g}" class="db-range" id="${idBase}-g" />
          <input type="range" min="0" max="255" value="${b}" class="db-range" id="${idBase}-b" />
          <div class="db-swatch" id="${idBase}-sw" style="background:${rgb(r,g,b)}"></div>
        </div>
      </div>`;
    } else {
      let min = 0, max = 1, step = 0.01, hint = '';
      const sub = keyPath.split('.')[1];
      if (sub === 'count') { min = 10; max = 20; step = 1; hint = `<span class="db-chip">${value}</span>`; }
      if (sub === 'sizeScale') { min = 0.5; max = 2.0; step = 0.05; hint = `<span class="db-chip">${value}</span>`; }
      if (sub === 'speed') { min = 0.1; max = 1.0; step = 0.01; hint = `<span class="db-chip">${value.toFixed(2)}</span>`; }
      return `
      <div class="db-row" data-key="${keyPath}">
        <div class="db-label">${label}</div>
        <div>
          <input type="range" min="${min}" max="${max}" step="${step}" value="${value}" class="db-range" id="${idBase}" />
          ${hint}
        </div>
      </div>`;
    }
  }

  function openPanel() {
    if (panelEl) return;
    panelEl = document.createElement('div');
    panelEl.className = 'db-panel';
    const presetOptions = ['random', ...Object.keys(PRESETS)]
      .map(name => `<option value="${name}" ${prefs.themeName===name?'selected':''}>${name === 'random' ? 'Random (install default)' : name}</option>`)
      .join('');
    panelEl.innerHTML = `
      <header>
        <div>Dreamy Blobs Settings</div>
        <button class="db-close" title="Close">&times;</button>
      </header>
      <div class="db-body">
        <div class="db-row">
          <div class="db-label">Preset Theme</div>
          <div>
            <select class="db-select" id="db-preset">${presetOptions}</select>
            <div class="db-subtle">Choose a dark-ish preset or Random. Adjust below for custom.</div>
          </div>
        </div>

        ${sliderRow('Background (RGB)', 'colors.bg')}
        ${sliderRow('Primary (RGB)', 'colors.primary')}
        ${sliderRow('Secondary (RGB)', 'colors.secondary')}
        ${sliderRow('Accent (RGB)', 'colors.accent')}

        ${sliderRow('Blob Count (10–20)', 'blobs.count')}
        ${sliderRow('Blob Size Scale', 'blobs.sizeScale')}
        ${sliderRow('Speed (slow → fast)', 'blobs.speed')}

        <div class="db-actions">
          <button class="db-btn" id="db-random">✨ Random Magic</button>
          <button class="db-btn" id="db-reset">↩ Reset</button>
          <button class="db-btn" id="db-toggle">${prefs.enabled ? '⏸ Pause' : '▶ Resume'}</button>
        </div>
        <div class="db-subtle">Changes apply instantly. Preferences persist across sites via Tampermonkey storage.</div>
      </div>
    `;
    document.documentElement.appendChild(panelEl);

    // Close
    panelEl.querySelector('.db-close').addEventListener('click', closePanel);

    // Preset change
    panelEl.querySelector('#db-preset').addEventListener('change', async (e) => {
      const name = e.target.value;
      prefs.themeName = name;
      if (name === 'random') {
        prefs.colors = {
          bg: randomDarkish(),
          primary: randomColor(),
          secondary: randomColor(),
          accent: randomColor()
        };
      } else {
        prefs.colors = structuredClone(PRESETS[name]);
      }
      await savePrefs();
      refreshPanelColors();
      applyPrefs();
    });

    // Color sliders
    panelEl.querySelectorAll('.db-col').forEach(col => {
      const keyPath = col.dataset.key;
      const [_, key] = keyPath.split('.');
      const rEl = col.querySelector(`#db-colors-${key}-r`);
      const gEl = col.querySelector(`#db-colors-${key}-g`);
      const bEl = col.querySelector(`#db-colors-${key}-b`);
      const sw = col.querySelector(`#db-colors-${key}-sw`);

      function onInput() {
        prefs.themeName = 'custom';
        prefs.colors[key] = [ +rEl.value, +gEl.value, +bEl.value ];
        sw.style.background = rgb(...prefs.colors[key]);
        savePrefs(); // async fire-and-forget
        applyPrefs();
      }
      rEl.addEventListener('input', onInput);
      gEl.addEventListener('input', onInput);
      bEl.addEventListener('input', onInput);
    });

    // Blob numeric sliders
    panelEl.querySelectorAll('.db-row[data-key^="blobs."]').forEach(row => {
      const keyPath = row.dataset.key;
      const input = row.querySelector('input[type="range"]');
      const chip = row.querySelector('.db-chip');
      input.addEventListener('input', async () => {
        const sub = keyPath.split('.')[1];
        prefs.blobs[sub] = sub === 'count' ? parseInt(input.value, 10) : parseFloat(input.value);
        if (chip) chip.textContent = sub === 'speed' ? +input.value : input.value;
        await savePrefs();
        applyPrefs();
      });
    });

    // Random / Reset / Toggle
    panelEl.querySelector('#db-random').addEventListener('click', async () => {
      prefs.themeName = 'custom';
      prefs.colors = {
        bg: randomDarkish(), // still dark-leaning bg; spec allows any colors though
        primary: randomColor(),
        secondary: randomColor(),
        accent: randomColor()
      };
      await savePrefs();
      refreshPanelColors();
      applyPrefs();
    });

    panelEl.querySelector('#db-reset').addEventListener('click', async () => {
      prefs = structuredClone(DEFAULTS);
      // default theme on reset is also random (matches install behavior)
      prefs.colors = {
        bg: randomDarkish(),
        primary: randomColor(),
        secondary: randomColor(),
        accent: randomColor()
      };
      await savePrefs();
      refreshEntirePanel();
      applyPrefs();
    });

    panelEl.querySelector('#db-toggle').addEventListener('click', async (e) => {
      prefs.enabled = !prefs.enabled;
      e.target.textContent = prefs.enabled ? '⏸ Pause' : '▶ Resume';
      await savePrefs();
      applyPrefs();
    });
  }

  function closePanel() {
    if (!panelEl) return;
    panelEl.remove();
    panelEl = null;
  }

  function refreshPanelColors() {
    if (!panelEl) return;
    for (const key of ['bg','primary','secondary','accent']) {
      const base = `#db-colors-${key}`;
      const col = panelEl.querySelector(`.db-col[data-key="colors.${key}"]`);
      if (!col) continue;
      const [r,g,b] = prefs.colors[key];
      col.querySelector(`${base}-r`).value = r;
      col.querySelector(`${base}-g`).value = g;
      col.querySelector(`${base}-b`).value = b;
      col.querySelector(`${base}-sw`).style.background = rgb(r,g,b);
    }
    // Set preset select
    const sel = panelEl.querySelector('#db-preset');
    if (sel) {
      // If colors match a preset exactly, keep it; else mark as custom
      const matchPreset = Object.entries(PRESETS).find(([name, val]) =>
        JSON.stringify(val) === JSON.stringify(prefs.colors)
      );
      prefs.themeName = matchPreset ? matchPreset[0] : (prefs.themeName === 'random' ? 'random' : 'custom');
      const optExists = [...sel.options].some(o => o.value === prefs.themeName);
      if (!optExists) {
        const opt = document.createElement('option');
        opt.value = 'custom'; opt.textContent = 'custom';
        sel.appendChild(opt);
      }
      sel.value = prefs.themeName;
    }
  }

  function refreshEntirePanel() {
    closePanel();
    openPanel();
  }

  // -----------------------------
  // Menu commands (Tampermonkey popup)
  // -----------------------------
  function registerMenu() {
    unregisterMenu();
    menuIds.push(GM_registerMenuCommand('🎛️ Open Dreamy Settings', openPanel));
    menuIds.push(GM_registerMenuCommand('✨ Random Magic', async () => {
      prefs.themeName = 'custom';
      prefs.colors = {
        bg: randomDarkish(),
        primary: randomColor(),
        secondary: randomColor(),
        accent: randomColor()
      };
      await savePrefs();
      refreshPanelColors();
      applyPrefs();
    }));
    menuIds.push(GM_registerMenuCommand('↩ Reset to Defaults', async () => {
      prefs = structuredClone(DEFAULTS);
      prefs.colors = {
        bg: randomDarkish(),
        primary: randomColor(),
        secondary: randomColor(),
        accent: randomColor()
      };
      await savePrefs();
      refreshEntirePanel();
      applyPrefs();
    }));
    menuIds.push(GM_registerMenuCommand(prefs.enabled ? '⏸ Pause Animation' : '▶ Resume Animation', async () => {
      prefs.enabled = !prefs.enabled;
      await savePrefs();
      applyPrefs();
      registerMenu(); // refresh label
    }));
  }
  function unregisterMenu() {
    while (menuIds.length) {
      const id = menuIds.pop();
      try { GM_unregisterMenuCommand(id); } catch {}
    }
  }

  // -----------------------------
  // Boot
  // -----------------------------
  (async function init() {
    await loadPrefs();
    ensureOverlay();
    applyPrefs();
    registerMenu();
  })();

})();
