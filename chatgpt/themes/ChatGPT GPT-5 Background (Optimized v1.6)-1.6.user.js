// ==UserScript==
// @name         ChatGPT GPT-5 Background (Optimized v1.6)
// @namespace    http://tampermonkey.net/
// @version      1.6
// @description  Optimized GPT-5 style background: hue-synced, faster drawing, placed inside app container to avoid being covered by opaque layers.
// @author       You
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @grant        none
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  // --- minimal logging helper (disabled by default) ---
  const LOG = false;
  const log = (...args) => { if (LOG) console.log(...args); };

  // --- Utilities ---
  function addCSS(css) {
    let style = document.querySelector('#gpt5-bg-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'gpt5-bg-style';
      document.head.appendChild(style);
    }
    style.textContent = css;
  }

  // Try to find the top app container to insert the background *inside* it
  function findAppContainer() {
    return document.querySelector('main, [role="main"], #__next, .app, body');
  }

  // --- Create and insert canvas inside app container so it's not covered ---
  function createCanvasInContainer() {
    const container = findAppContainer() || document.body;
    if (!container) return null;

    // ensure container creates a stacking context
    const computed = getComputedStyle(container);
    if (computed.position === 'static') {
      container.style.position = 'relative';
    }

    // prevent duplicate
    let wrapper = container.querySelector('#gpt5-bg-wrapper');
    if (wrapper) return wrapper;

    wrapper = document.createElement('div');
    wrapper.id = 'gpt5-bg-wrapper';
    wrapper.style.cssText = `
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 0;
      overflow: hidden;
    `;

    // Insert as first child so it sits behind app children
    container.insertBefore(wrapper, container.firstChild);

    const canvas = document.createElement('canvas');
    canvas.id = 'gpt5-bg-canvas';
    canvas.style.cssText = `
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      will-change: filter;
      display:block;
    `;
    wrapper.appendChild(canvas);
    return wrapper;
  }

  // --- Particle system (optimized) ---
  function startBackground() {
    const wrapper = createCanvasInContainer();
    if (!wrapper) {
      log('no wrapper found');
      return;
    }
    const canvas = wrapper.querySelector('#gpt5-bg-canvas');
    const ctx = canvas.getContext('2d');

    // device pixel ratio scaling
    function resize() {
      const rect = wrapper.getBoundingClientRect();
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      w = Math.round(rect.width);
      h = Math.round(rect.height);
    }

    let w = 0, h = 0;
    resize();

    window.addEventListener('resize', () => {
      // debounce resize a little
      clearTimeout(window.__gpt5_resize_timeout);
      window.__gpt5_resize_timeout = setTimeout(resize, 80);
    });

    // Colors (same palette)
    const colors = [
      'rgba(74, 144, 226, 0.45)',  // Blue
      'rgba(80, 227, 194, 0.45)',  // Teal
      'rgba(162, 155, 254, 0.45)', // Purple
      'rgba(255, 107, 107, 0.45)', // Red
      'rgba(255, 206, 84, 0.45)',  // Yellow
      'rgba(129, 236, 236, 0.45)', // Cyan
      'rgba(255, 159, 243, 0.45)', // Pink
      'rgba(161, 255, 206, 0.45)'  // Green
    ];

    // Pre-render small sprite for each color (base size)
    const SPRITE_BASE = 256;
    const sprites = colors.map(col => {
      const s = document.createElement('canvas');
      s.width = s.height = SPRITE_BASE;
      const sc = s.getContext('2d');
      const cx = SPRITE_BASE / 2;
      const cy = SPRITE_BASE / 2;
      const r = SPRITE_BASE / 2;
      const grad = sc.createRadialGradient(cx, cy, 0, cx, cy, r);
      // convert color to remove alpha for center stop then set edge transparent
      grad.addColorStop(0, col);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      sc.fillStyle = grad;
      sc.beginPath();
      sc.arc(cx, cy, r, 0, Math.PI * 2);
      sc.fill();
      return s;
    });

    class Particle {
      constructor() {
        this.reset();
      }
      reset() {
        this.x = Math.random() * w;
        this.y = Math.random() * h;
        this.size = Math.random() * 40 + 12; // smaller avg size for perf
        this.vx = (Math.random() - 0.5) * 1.2;
        this.vy = (Math.random() - 0.5) * 1.2;
        this.sprite = sprites[Math.floor(Math.random() * sprites.length)];
        this.alpha = Math.random() * 0.35 + 0.12;
        this.pulseSpeed = Math.random() * 0.02 + 0.004;
        this.phase = Math.random() * Math.PI * 2;
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.phase += this.pulseSpeed;
        if (this.x < -100) this.x = w + 100;
        if (this.x > w + 100) this.x = -100;
        if (this.y < -100) this.y = h + 100;
        if (this.y > h + 100) this.y = -100;
      }
      draw(ctx) {
        const pulse = Math.sin(this.phase) * 0.25 + 0.75;
        const size = this.size * pulse;
        ctx.save();
        ctx.globalAlpha = this.alpha * pulse;
        // draw pre-rendered sprite scaled to desired size
        ctx.drawImage(this.sprite, this.x - size/2, this.y - size/2, size, size);
        ctx.restore();
      }
    }

    // fewer particles for smooth perf
    const PARTICLE_COUNT = Math.max(10, Math.round((w*h) / (1920*1080) * 22)); // scale with viewport
    const particles = Array.from({ length: PARTICLE_COUNT }, () => new Particle());
    log('particles', particles.length);

    // background gradient parameters
    function drawBackground(ctx) {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, 'rgba(15, 23, 42, 0.96)');
      g.addColorStop(0.5, 'rgba(30, 41, 59, 0.92)');
      g.addColorStop(1, 'rgba(10, 14, 22, 0.96)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    // hue control (throttled updates for DOM)
    let hue = 0;
    let frame = 0;
    const THROTTLE_FRAMES = 3; // update DOM filter & CSS variable every 3 frames

    function animate() {
      // Guard against 0 size
      const rect = wrapper.getBoundingClientRect();
      if (Math.round(rect.width) !== w || Math.round(rect.height) !== h) {
        resize(); // adapt to container change
      }

      ctx.clearRect(0, 0, w, h);
      drawBackground(ctx);

      for (let p of particles) {
        p.update();
        p.draw(ctx);
      }

      frame++;
      if (frame % THROTTLE_FRAMES === 0) {
        hue = (hue + 0.35) % 360;
        const hueValue = `${hue}deg`;
        // apply filter to canvas element (not ctx.filter) — reliable and GPU-accelerated
        canvas.style.filter = `hue-rotate(${hueValue})`;
        canvas.style.webkitFilter = `hue-rotate(${hueValue})`;
        // update CSS variable for UI elements (throttled)
        document.documentElement.style.setProperty('--gpt5-hue', hueValue);
      }

      requestAnimationFrame(animate);
    }

    animate();
  } // end startBackground

  // --- Interface tweaks (keeps hover/focus outlines and ensures translucency) ---
  function applyInterfaceCSS() {
    const css = `
      :root { --gpt5-hue: 0deg; }

      /* ensure app content sits above background wrapper */
      #gpt5-bg-wrapper { z-index: 0; }

      /* Make body/main backgrounds transparent so background inside app shows */
      body, main, [role="main"], #__next {
        background: transparent !important;
      }

      /* Generic containers we want translucent (tried to be broad but safe) */
      :is([class*="main"], [class*="container"], [class*="app"], [class*="chat"], [class*="pane"]) {
        background: transparent !important;
      }

      /* Sidebar / nav / menu: subtle tint + hue rotate */
      :is([class*="sidebar"], [class*="nav"], [class*="menu"]) {
        background: rgba(15,23,42,0.82) !important;
        backdrop-filter: blur(10px) !important;
        filter: hue-rotate(var(--gpt5-hue)) !important;
        -webkit-filter: hue-rotate(var(--gpt5-hue)) !important;
        transition: filter 0.25s linear !important;
      }

      /* Interactive focus/hover outlines restored */
      :is(a, button, [role="button"], [role="tab"], [class*="item"], [class*="conversation"], [class*="group"]):hover,
      :is(a, button, [role="button"], [role="tab"], [class*="item"], [class*="conversation"], [class*="group"]):focus-visible {
        outline: 2px solid rgba(255,255,255,0.95) !important;
        outline-offset: 3px !important;
        box-shadow: 0 4px 14px rgba(0,0,0,0.25) !important;
        z-index: 2 !important;
      }

      /* Make sure code blocks stay readable */
      pre, [class*="code"], code {
        background: rgba(0,0,0,0.36) !important;
        border: 1px solid rgba(255,255,255,0.06) !important;
      }

      /* Hide inline backgrounds that would fully obscure background *only* if safe */
      div[style*="background-color"], div[style*="background"] {
        background-color: transparent !important;
        background: transparent !important;
      }
    `;
    addCSS(css);
  }

  // --- Init and SPA handling ---
  function initOnce() {
    try {
      applyInterfaceCSS();
      startBackground();
    } catch (e) {
      console.error('GPT5 background init error', e);
    }
  }

  // Start when DOM ready-ish
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initOnce();
  } else {
    window.addEventListener('DOMContentLoaded', initOnce, { once: true });
  }

  // Re-apply if SPA re-renders the app container (keep single instance)
  const mo = new MutationObserver(() => {
    if (!document.querySelector('#gpt5-bg-wrapper') || !document.querySelector('#gpt5-bg-style')) {
      initOnce();
    }
  });
  mo.observe(document.documentElement || document.body, { childList: true, subtree: true });

})();
