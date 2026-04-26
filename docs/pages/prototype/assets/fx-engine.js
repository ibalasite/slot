/**
 * Thunder Blessing — FX & Animation Engine
 * Canvas particle system + CSS animation helpers.
 * All public methods guard against null canvas / missing elements.
 */

'use strict';

// ============================================================
// Particle (internal)
// ============================================================
class Particle {
  constructor(cfg) {
    this.x        = cfg.x  ?? 0;
    this.y        = cfg.y  ?? 0;
    this.vx       = cfg.vx ?? (Math.random() - 0.5) * 8;
    this.vy       = cfg.vy ?? (Math.random() * -6 - 2);
    this.ay       = cfg.ay ?? 0.22;
    this.life     = 1.0;
    this.decay    = cfg.decay ?? (0.010 + Math.random() * 0.014);
    this.size     = cfg.size  ?? (4 + Math.random() * 6);
    this.color    = cfg.color ?? '#FFD700';
    this.shape    = cfg.shape ?? 'circle';   // circle | square | star
    this.rotation = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 0.18;
    this.glow     = cfg.glow     ?? false;
    this.glowColor= cfg.glowColor ?? this.color;
  }

  update(dt) {
    this.vy += this.ay * dt;
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.life -= this.decay * dt;
    this.rotation += this.rotSpeed * dt;
    return this.life > 0;
  }

  draw(ctx) {
    if (this.life <= 0 || this.size <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    if (this.glow) {
      ctx.shadowBlur  = this.size * 2;
      ctx.shadowColor = this.glowColor;
    }
    ctx.fillStyle = this.color;
    if (this.shape === 'square') {
      const h = this.size * this.life;
      ctx.fillRect(-h / 2, -h / 2, h, h);
    } else if (this.shape === 'star') {
      const s = this.size * this.life;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
        const r = i % 2 === 0 ? s : s * 0.38;
        ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
      }
      ctx.closePath();
      ctx.fill();
    } else {
      const r = (this.size / 2) * this.life;
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(0.1, r), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ============================================================
// FXEngine
// ============================================================
class FXEngine {
  constructor(canvas) {
    this._canvas      = canvas || null;
    this._ctx         = canvas ? canvas.getContext('2d') : null;
    this._particles   = [];
    this._rafId       = null;
    this._running     = false;
    this._lastTime    = 0;
    this._ambientTimer= null;
  }

  // ----------------------------------------------------------
  // INIT — accepts either a canvas element or a canvas id string
  // ----------------------------------------------------------
  init(canvasOrId) {
    if (typeof canvasOrId === 'string') {
      const el = document.getElementById(canvasOrId);
      if (el) {
        this._canvas = el;
        this._ctx    = el.getContext('2d');
      }
    } else if (canvasOrId instanceof HTMLCanvasElement) {
      this._canvas = canvasOrId;
      this._ctx    = canvasOrId.getContext('2d');
    }
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.startAnimationLoop();
    this.startAmbientSparkle(0.3);
  }

  // ----------------------------------------------------------
  // Canvas sizing
  // ----------------------------------------------------------
  resize() {
    if (!this._canvas) return;
    this._canvas.width  = window.innerWidth;
    this._canvas.height = window.innerHeight;
  }

  // ----------------------------------------------------------
  // Animation loop
  // ----------------------------------------------------------
  startAnimationLoop() {
    if (this._running) return;
    this._running  = true;
    this._lastTime = performance.now();
    const loop = (now) => {
      if (!this._running) return;
      this._rafId = requestAnimationFrame(loop);
      const dt = Math.min((now - this._lastTime) / 16.67, 3);
      this._lastTime = now;
      this._tick(dt);
    };
    this._rafId = requestAnimationFrame(loop);
  }

  stopAnimationLoop() {
    this._running = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  _tick(dt) {
    if (!this._ctx || !this._canvas) return;
    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    this._particles = this._particles.filter(p => p.update(dt));
    for (const p of this._particles) p.draw(this._ctx);
  }

  // ----------------------------------------------------------
  // Ambient sparkle
  // ----------------------------------------------------------
  startAmbientSparkle(density = 0.4) {
    this.stopAmbientSparkle();
    const intervalMs = Math.max(40, 120 / density);
    this._ambientTimer = setInterval(() => {
      if (!this._canvas) return;
      const x = Math.random() * this._canvas.width;
      const y = Math.random() * this._canvas.height * 0.7;
      this._emit(1, x, y, {
        vx: (Math.random() - 0.5) * 1.5,
        vy: -Math.random() * 1,
        ay: -0.03,
        size: 1.5 + Math.random() * 2,
        color: Math.random() > 0.5 ? '#FFD700' : '#C0A030',
        decay: 0.008 + Math.random() * 0.008,
        glow: true,
        glowColor: '#FFD700',
        shape: 'circle',
      });
    }, intervalMs);
  }

  stopAmbientSparkle() {
    if (this._ambientTimer !== null) {
      clearInterval(this._ambientTimer);
      this._ambientTimer = null;
    }
  }

  // ----------------------------------------------------------
  // Emitter helper
  // ----------------------------------------------------------
  _emit(count, x, y, overrides = {}) {
    for (let i = 0; i < count; i++) {
      this._particles.push(new Particle({ x, y, ...overrides }));
    }
  }

  // ----------------------------------------------------------
  // PUBLIC FX METHODS
  // ----------------------------------------------------------

  /**
   * Gold coin burst — radiates gold particles from (x, y).
   * Used on Win Celebration (screen-09).
   */
  coinBurst(x, y, count = 60) {
    const colors = ['#FFD700', '#DCA331', '#FFE55C', '#C8860A', '#FFC000'];
    const shapes = ['circle', 'square', 'star'];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 9;
      this._particles.push(new Particle({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 4,
        ay: 0.28,
        size:  5 + Math.random() * 7,
        color: colors[Math.floor(Math.random() * colors.length)],
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        decay: 0.007 + Math.random() * 0.010,
        glow: i % 4 === 0,
        glowColor: '#FFD700',
      }));
    }
  }

  /**
   * Gold coin rain — continuous rain from top of screen.
   */
  goldCoinRain(centerX, topY, count = 50) {
    const spread = Math.min(centerX, (this._canvas ? this._canvas.width : 800) - centerX);
    for (let i = 0; i < count; i++) {
      const x = centerX + (Math.random() - 0.5) * spread * 1.8;
      this._particles.push(new Particle({
        x, y: topY - Math.random() * 80,
        vx: (Math.random() - 0.5) * 3,
        vy: 2 + Math.random() * 5,
        ay: 0.15,
        size:  6 + Math.random() * 6,
        color: ['#FFD700', '#DCA331', '#FFE55C'][Math.floor(Math.random() * 3)],
        shape: Math.random() > 0.4 ? 'circle' : 'star',
        decay: 0.004 + Math.random() * 0.008,
        glow: Math.random() > 0.6,
        glowColor: '#FFD700',
      }));
    }
  }

  /**
   * Lightning flash — full-screen DOM overlay + canvas sparks.
   * Used for Thunder Blessing trigger (screen-06).
   */
  lightningFlash() {
    // DOM flash overlay
    const flash = document.createElement('div');
    flash.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:7900',
      'background:radial-gradient(ellipse,rgba(255,229,92,0.55) 0%,rgba(255,140,0,0.25) 50%,transparent 80%)',
      'pointer-events:none',
      'animation:_lf-anim 0.55s ease-out forwards',
    ].join(';');

    if (!document.getElementById('_lf-kf')) {
      const style = document.createElement('style');
      style.id = '_lf-kf';
      style.textContent = `@keyframes _lf-anim {
        0%   { opacity:0; }
        15%  { opacity:1; }
        40%  { opacity:0.6; }
        70%  { opacity:0.2; }
        100% { opacity:0; }
      }`;
      document.head.appendChild(style);
    }
    document.body.appendChild(flash);
    setTimeout(() => { if (flash.parentNode) flash.parentNode.removeChild(flash); }, 600);

    // Canvas sparks
    if (this._canvas) {
      const cx = this._canvas.width / 2;
      const cy = this._canvas.height * 0.3;
      for (let i = 0; i < 30; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 4 + Math.random() * 10;
        this._particles.push(new Particle({
          x: cx + (Math.random() - 0.5) * 300,
          y: cy + (Math.random() - 0.5) * 200,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          ay: 0.05,
          size: 2 + Math.random() * 4,
          color: Math.random() > 0.5 ? '#FFE55C' : '#FF8C00',
          shape: 'circle',
          decay: 0.018 + Math.random() * 0.020,
          glow: true,
          glowColor: '#FFE55C',
        }));
      }
    }
  }

  /**
   * Thunder Blessing burst — fires from each scatter symbol element.
   * @param {Element[]} scatterEls
   */
  thunderBlessingBurst(scatterEls) {
    this.lightningFlash();
    for (const el of (scatterEls || [])) {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width  / 2;
      const cy = rect.top  + rect.height / 2;
      this.coinBurst(cx, cy, 12);
    }
  }

  // ----------------------------------------------------------
  // SCREEN ENTER — opacity + scale fade-in
  // ----------------------------------------------------------
  screenEnter(el) {
    if (!el) return;
    el.style.opacity   = '0';
    el.style.transform = 'scale(0.97)';
    el.style.transition = 'opacity 300ms ease, transform 300ms ease';
    requestAnimationFrame(() => {
      el.style.opacity   = '1';
      el.style.transform = 'scale(1)';
    });
  }

  // ----------------------------------------------------------
  // SYMBOL DROP — bounce-fall animation for cascade new symbols
  // ----------------------------------------------------------
  symbolDrop(cellEl, delayMs = 0) {
    if (!cellEl) return;
    cellEl.style.animation = 'none';
    cellEl.style.transform = 'translateY(-60px)';
    cellEl.style.opacity   = '0';
    setTimeout(() => {
      cellEl.style.transition = 'none';
      cellEl.style.animation  =
        `_sym-drop 400ms ${delayMs}ms cubic-bezier(0.34,1.56,0.64,1) both`;
    }, 10);

    if (!document.getElementById('_sym-drop-kf')) {
      const style = document.createElement('style');
      style.id = '_sym-drop-kf';
      style.textContent = `@keyframes _sym-drop {
        0%   { transform:translateY(-60px); opacity:0; }
        60%  { transform:translateY(8px);  opacity:1; }
        80%  { transform:translateY(-4px); }
        100% { transform:translateY(0);    opacity:1; }
      }`;
      document.head.appendChild(style);
    }
  }

  // ----------------------------------------------------------
  // COIN FLIP — 3-D rotateY for Coin Toss
  // @param {Element}  coinEl
  // @param {string}   result  'HEADS' | 'TAILS'
  // @param {Function} onDone  callback after animation
  // ----------------------------------------------------------
  coinFlip(coinEl, result, onDone) {
    if (!coinEl) { if (onDone) onDone(); return; }

    if (!document.getElementById('_cf-kf')) {
      const style = document.createElement('style');
      style.id = '_cf-kf';
      style.textContent = `
        @keyframes _cf-heads {
          0%   { transform:rotateY(0deg)   scale(1);    }
          40%  { transform:rotateY(540deg) scale(1.15); }
          100% { transform:rotateY(720deg) scale(1);    }
        }
        @keyframes _cf-tails {
          0%   { transform:rotateY(0deg)   scale(1);    }
          40%  { transform:rotateY(540deg) scale(1.15); }
          100% { transform:rotateY(900deg) scale(1);    }
        }`;
      document.head.appendChild(style);
    }

    const animName = result === 'HEADS' ? '_cf-heads' : '_cf-tails';
    coinEl.style.animation = `${animName} 700ms cubic-bezier(0.4,0,0.2,1) forwards`;

    let called = false;
    const done = () => {
      if (called) return;
      called = true;
      coinEl.removeEventListener('animationend', done);
      if (onDone) onDone();
    };
    coinEl.addEventListener('animationend', done);
    setTimeout(done, 800); // safety fallback
  }

  // ----------------------------------------------------------
  // WIN COUNTER — animated number roll-up (ease-out cubic)
  // @param {Element}  el
  // @param {number}   from
  // @param {number}   to
  // @param {number}   durationMs
  // @param {Function} formatter  (value) => string
  // ----------------------------------------------------------
  animateCounter(el, from, to, durationMs, formatter) {
    if (!el) return;
    const start = performance.now();
    const range = to - from;
    const fmt   = typeof formatter === 'function' ? formatter : v => v.toFixed(2);

    const step = (now) => {
      const elapsed  = now - start;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      el.textContent = fmt(from + range * eased);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // Alias used by prototype.js
  rollUp(el, from, to, durationMs) {
    this.animateCounter(el, from, to, durationMs || 1500);
  }

  // ----------------------------------------------------------
  // MULTIPLIER POP — scale-bounce for FG multiplier badges
  // ----------------------------------------------------------
  multiplierPop(el) {
    if (!el) return;
    if (!document.getElementById('_mp-kf')) {
      const style = document.createElement('style');
      style.id = '_mp-kf';
      style.textContent = `@keyframes _mp {
        0%   { transform:scale(0.5);  opacity:0; }
        60%  { transform:scale(1.25); opacity:1; }
        80%  { transform:scale(0.92); }
        100% { transform:scale(1);    opacity:1; }
      }`;
      document.head.appendChild(style);
    }
    el.style.animation = 'none';
    requestAnimationFrame(() => {
      el.style.animation = '_mp 400ms cubic-bezier(0.34,1.56,0.64,1) forwards';
    });
  }

  // Alias: scalePop
  scalePop(el) { this.multiplierPop(el); }

  // ----------------------------------------------------------
  // REEL SPIN / STOP — toggle CSS classes on reel columns
  // ----------------------------------------------------------
  reelSpin(reelIndex) {
    const col = document.getElementById(`reel-col-${reelIndex}`);
    if (!col) return;
    col.classList.add('spinning');
    col.classList.remove('stopping');
  }

  reelStop(reelIndex) {
    const col = document.getElementById(`reel-col-${reelIndex}`);
    if (!col) return;
    col.classList.remove('spinning');
    col.classList.add('stopping');
    // Drop each symbol with stagger
    const cells = col.querySelectorAll('.symbol-cell');
    cells.forEach((cell, i) => this.symbolDrop(cell, i * 60));
    setTimeout(() => col.classList.remove('stopping'), 400);
  }

  // ----------------------------------------------------------
  // SCREEN TRANSITION — fade between two screen elements
  // ----------------------------------------------------------
  screenTransition(fromEl, toEl) {
    if (fromEl) {
      fromEl.style.transition = 'opacity 200ms ease';
      fromEl.style.opacity = '0';
    }
    setTimeout(() => {
      if (fromEl) fromEl.style.display = 'none';
      if (toEl) {
        toEl.style.display = 'block';
        this.screenEnter(toEl);
      }
    }, 200);
  }
}

// Expose globally — prototype.js and index.html both reference window.fxEngine
window.FXEngine = FXEngine;
// Create default instance; init() is called after DOM ready
window.fxEngine = new FXEngine();
