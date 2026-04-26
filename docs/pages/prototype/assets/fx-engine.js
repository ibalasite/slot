/**
 * Thunder Blessing — FX Engine
 * Canvas-based particle system + CSS animation controller
 */

// ============================================================
// Particle System
// ============================================================
class Particle {
  constructor(config) {
    this.x       = config.x ?? 0;
    this.y       = config.y ?? 0;
    this.vx      = config.vx ?? (Math.random() - 0.5) * 6;
    this.vy      = config.vy ?? (Math.random() - 0.5) * 6;
    this.ax      = config.ax ?? 0;
    this.ay      = config.ay ?? 0.18;   // gravity
    this.life    = config.life ?? 1.0;
    this.decay   = config.decay ?? (0.012 + Math.random() * 0.015);
    this.size    = config.size ?? (4 + Math.random() * 6);
    this.sizeDecay = config.sizeDecay ?? 0.02;
    this.color   = config.color ?? '#FFD700';
    this.alpha   = config.alpha ?? 1.0;
    this.shape   = config.shape ?? 'circle';  // circle | square | star | line
    this.rotation = config.rotation ?? 0;
    this.rotSpeed = config.rotSpeed ?? (Math.random() - 0.5) * 0.2;
    this.glow    = config.glow ?? false;
    this.glowColor = config.glowColor ?? this.color;
  }

  update(dt) {
    this.vx += this.ax * dt;
    this.vy += this.ay * dt;
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.life -= this.decay * dt;
    this.alpha = Math.max(0, this.life);
    this.size = Math.max(0, this.size - this.sizeDecay * dt);
    this.rotation += this.rotSpeed * dt;
    return this.life > 0;
  }

  draw(ctx) {
    if (this.alpha <= 0 || this.size <= 0) return;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    if (this.glow) {
      ctx.shadowBlur = this.size * 2.5;
      ctx.shadowColor = this.glowColor;
    }

    ctx.fillStyle = this.color;

    switch (this.shape) {
      case 'square':
        ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        break;
      case 'star': {
        const s = this.size;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
          const r = i % 2 === 0 ? s : s * 0.4;
          ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
        }
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'line': {
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-this.size / 2, 0);
        ctx.lineTo(this.size / 2, 0);
        ctx.stroke();
        break;
      }
      default: // circle
        ctx.beginPath();
        ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
  }
}

// ============================================================
// FXEngine Class
// ============================================================
class FXEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    this.particles = [];
    this.running = false;
    this.lastTime = 0;
    this.raf = null;
    // Tracks all active lightning animation frame handles so they can be
    // cancelled on destroy() regardless of how many are in-flight at once.
    this._lightningRafs = new Set();
    // Per-column timeout handles for reel spin/stop so rapid consecutive calls
    // cancel any previously queued timeout instead of stacking them.
    this._reelSpinTimeouts = {};   // colIndex → timeoutId
    this._reelStopTimeouts = {};   // colIndex → timeoutId

    // Bind
    this._frame = this._frame.bind(this);
  }

  // ----------------------------------------------------------
  // Animation Loop
  // ----------------------------------------------------------
  startAnimationLoop() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame(this._frame);
  }

  stopAnimationLoop() {
    this.running = false;
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
  }

  _frame(now) {
    if (!this.running) return;
    const dt = Math.min((now - this.lastTime) / 16.67, 3); // clamp delta
    this.lastTime = now;
    this.update(dt);
    this.render();
    this.raf = requestAnimationFrame(this._frame);
  }

  // ----------------------------------------------------------
  // Update + Render
  // ----------------------------------------------------------
  update(dt) {
    this.particles = this.particles.filter(p => p.update(dt));
  }

  render() {
    if (!this.ctx || !this.canvas) return;
    const { width, height } = this.canvas;
    this.ctx.clearRect(0, 0, width, height);
    for (const p of this.particles) {
      p.draw(this.ctx);
    }
  }

  // ----------------------------------------------------------
  // Resize canvas to fill window
  // ----------------------------------------------------------
  resize() {
    if (!this.canvas) return;
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  // ----------------------------------------------------------
  // Particle factory
  // ----------------------------------------------------------
  createParticles(config) {
    const count = config.count ?? 20;
    for (let i = 0; i < count; i++) {
      this.particles.push(new Particle({ ...config, ...this._particleVariance(config) }));
    }
  }

  _particleVariance(config) {
    const spread = config.spread ?? 30;
    return {
      x: (config.x ?? 0) + (Math.random() - 0.5) * spread,
      y: (config.y ?? 0) + (Math.random() - 0.5) * spread,
      vx: (config.vxBase ?? 0) + (Math.random() - 0.5) * (config.vxSpread ?? 8),
      vy: (config.vyBase ?? -4) + (Math.random() - 0.5) * (config.vySpread ?? 6),
      life: (config.life ?? 1.0) * (0.7 + Math.random() * 0.5),
      size: (config.size ?? 6) * (0.5 + Math.random() * 1.2),
      decay: (config.decay ?? 0.012) * (0.7 + Math.random() * 0.6),
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.3,
    };
  }

  // ----------------------------------------------------------
  // Get element center in viewport coordinates
  // ----------------------------------------------------------
  _getElCenter(el) {
    if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    // Accept plain {x, y} coordinate objects as well as real DOM elements so
    // callers never need to construct synthetic duck-typed wrapper objects.
    if (typeof el.x === 'number' && typeof el.y === 'number' && !el.getBoundingClientRect) {
      return { x: el.x, y: el.y };
    }
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  // ----------------------------------------------------------
  // GOLD COIN RAIN
  // ----------------------------------------------------------
  goldCoinRain(x, y, count = 30) {
    const colors = ['#FFD700', '#FFE55C', '#DCA331', '#FFA500'];
    for (let i = 0; i < count; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      this.particles.push(new Particle({
        x: x + (Math.random() - 0.5) * 200,
        y: y,
        vx: (Math.random() - 0.5) * 10,
        vy: -(4 + Math.random() * 8),
        ay: 0.35,
        life: 1.0,
        decay: 0.008 + Math.random() * 0.008,
        size: 8 + Math.random() * 10,
        color,
        shape: Math.random() > 0.5 ? 'circle' : 'square',
        glow: true,
        glowColor: '#FFD700',
        rotation: Math.random() * Math.PI,
        rotSpeed: (Math.random() - 0.5) * 0.25,
      }));
    }
  }

  // ----------------------------------------------------------
  // SYMBOL EXPLODE
  // ----------------------------------------------------------
  symbolExplode(cellEl, count = 18) {
    const c = this._getElCenter(cellEl);
    const colors = ['#FFE55C', '#FF8C00', '#FFD700', '#FFF', '#DCA331'];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 3 + Math.random() * 7;
      const color = colors[Math.floor(Math.random() * colors.length)];
      this.particles.push(new Particle({
        x: c.x, y: c.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        ay: 0.15,
        life: 0.9,
        decay: 0.018 + Math.random() * 0.015,
        size: 4 + Math.random() * 8,
        color,
        shape: Math.random() > 0.6 ? 'square' : 'circle',
        glow: Math.random() > 0.5,
        glowColor: color,
        rotation: angle,
        rotSpeed: (Math.random() - 0.5) * 0.4,
      }));
    }
  }

  // ----------------------------------------------------------
  // CASCADE EXPLOSION (multiple cells)
  // ----------------------------------------------------------
  cascadeExplosion(cellEls) {
    cellEls.forEach((el, i) => {
      setTimeout(() => this.symbolExplode(el, 12), i * 30);
    });
  }

  // ----------------------------------------------------------
  // LIGHTNING ARC (canvas drawn line with glow)
  // ----------------------------------------------------------
  lightningArc(fromEl, toEl) {
    if (!this.ctx) return;
    const from = this._getElCenter(fromEl);
    const to = toEl ? this._getElCenter(toEl) : { x: from.x + 60, y: from.y - 80 };

    // Draw lightning bolt as a series of jagged line segments.
    // Each active animation RAF handle is registered in this._lightningRafs so
    // destroy() can cancel all of them even when multiple arcs are in-flight.
    const drawLightning = (duration = 400) => {
      const start = performance.now();
      let handle = null;
      let frameCount = 0;

      const scheduleNext = () => {
        handle = requestAnimationFrame(draw);
        this._lightningRafs.add(handle);
      };

      const draw = () => {
        const elapsed = performance.now() - start;

        // Remove the handle that just fired now that we know we entered the
        // callback. Doing this after the elapsed check would leave a stale
        // handle in the Set if we return early, so we always clean up first.
        this._lightningRafs.delete(handle);
        handle = null;

        if (elapsed >= duration) return;   // hard stop — no further scheduling

        frameCount++;
        // Draw every other frame for a flickering look
        if (frameCount % 2 === 0) {
          const points = this._jaggedPath(from, to, 6);
          const alpha = 0.8 * (1 - elapsed / duration);
          this.ctx.save();
          this.ctx.globalAlpha = alpha;
          this.ctx.strokeStyle = '#FFE55C';
          this.ctx.lineWidth = 2;
          this.ctx.shadowBlur = 12;
          this.ctx.shadowColor = '#FFD700';
          this.ctx.beginPath();
          this.ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            this.ctx.lineTo(points[i].x, points[i].y);
          }
          this.ctx.stroke();

          // Core bright line
          this.ctx.strokeStyle = '#FFF';
          this.ctx.lineWidth = 1;
          this.ctx.shadowBlur = 4;
          this.ctx.stroke();
          this.ctx.restore();
        }

        scheduleNext();
      };

      scheduleNext();
    };

    drawLightning(500);

    // Add sparks at endpoints
    this.createParticles({
      x: from.x, y: from.y,
      count: 8,
      color: '#FFE55C',
      size: 4,
      decay: 0.04,
      vxSpread: 6, vySpread: 6, vyBase: -2,
      glow: true, glowColor: '#FFD700',
      spread: 5,
    });
    this.createParticles({
      x: to.x, y: to.y,
      count: 8,
      color: '#FFE55C',
      size: 4,
      decay: 0.04,
      vxSpread: 6, vySpread: 6, vyBase: -2,
      glow: true, glowColor: '#FFD700',
      spread: 5,
    });
  }

  _jaggedPath(from, to, segments) {
    const points = [from];
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const bx = from.x + (to.x - from.x) * t;
      const by = from.y + (to.y - from.y) * t;
      const jitter = 25 * (1 - Math.abs(t - 0.5) * 2);
      points.push({
        x: bx + (Math.random() - 0.5) * jitter * 2,
        y: by + (Math.random() - 0.5) * jitter * 2,
      });
    }
    points.push(to);
    return points;
  }

  // ----------------------------------------------------------
  // THUNDER BLESSING BURST
  // ----------------------------------------------------------
  thunderBlessingBurst(cellEls, markerEls) {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    // White flash effect (done via DOM, not canvas)
    this.whiteFlash(0.85);

    // Lightning from a virtual center point to each real DOM marker element.
    // _getElCenter already accepts real DOM elements via getBoundingClientRect,
    // so we pass a plain coordinate object for the fixed source and the actual
    // DOM element for the destination — no duck-typed synthetic wrapper needed.
    if (markerEls && markerEls.length) {
      markerEls.forEach((el, i) => {
        setTimeout(() => {
          const dest = this._getElCenter(el);
          this.lightningArc({ x: centerX, y: centerY }, dest);
        }, i * 80);
      });
    }

    // Explode each cell with delay cascade
    cellEls.forEach((el, i) => {
      setTimeout(() => {
        this.symbolExplode(el, 22);
        const c = this._getElCenter(el);
        // Gold ring burst
        for (let j = 0; j < 16; j++) {
          const angle = (j / 16) * Math.PI * 2;
          this.particles.push(new Particle({
            x: c.x, y: c.y,
            vx: Math.cos(angle) * (5 + Math.random() * 5),
            vy: Math.sin(angle) * (5 + Math.random() * 5),
            ay: 0.05,
            life: 0.7,
            decay: 0.025,
            size: 5 + Math.random() * 5,
            color: '#FFE55C',
            shape: 'star',
            glow: true, glowColor: '#FFD700',
          }));
        }
      }, i * 100 + 200);
    });

    // Final coin rain from top
    setTimeout(() => {
      this.goldCoinRain(centerX, 0, 50);
      this.goldCoinRain(centerX - 150, -50, 20);
      this.goldCoinRain(centerX + 150, -50, 20);
    }, cellEls.length * 100 + 400);
  }

  // ----------------------------------------------------------
  // WHITE FLASH
  // ----------------------------------------------------------
  whiteFlash(intensity = 0.7) {
    const el = document.createElement('div');
    el.style.cssText = `
      position: fixed; inset: 0; z-index: 7999;
      background: rgba(255,255,255,${intensity});
      pointer-events: none;
      animation: none;
      opacity: ${intensity};
      transition: opacity 0.4s ease-out;
    `;
    document.body.appendChild(el);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 450);
      });
    });
  }

  // ----------------------------------------------------------
  // CSS ANIMATION HELPERS
  // ----------------------------------------------------------
  applyCSS(el, animClass, duration = 500) {
    if (!el) return Promise.resolve();
    el.classList.add(animClass);
    return new Promise(resolve => {
      setTimeout(() => {
        el.classList.remove(animClass);
        resolve();
      }, duration);
    });
  }

  // Apply class then auto-remove after CSS animation ends
  animate(el, animClass) {
    if (!el) return Promise.resolve();
    return new Promise(resolve => {
      const onEnd = () => {
        el.classList.remove(animClass);
        el.removeEventListener('animationend', onEnd);
        resolve();
      };
      el.addEventListener('animationend', onEnd, { once: true });
      el.classList.add(animClass);
      // Fallback
      setTimeout(() => {
        el.classList.remove(animClass);
        resolve();
      }, 2000);
    });
  }

  // ----------------------------------------------------------
  // REEL SPIN / STOP
  // ----------------------------------------------------------
  reelSpin(colIndex, duration = 1500) {
    const col = document.querySelectorAll('.reel-col')[colIndex];
    if (!col) return;
    // Cancel any pending spin timeout for this column before queuing a new one.
    clearTimeout(this._reelSpinTimeouts[colIndex]);
    col.classList.add('spinning');
    this._reelSpinTimeouts[colIndex] = setTimeout(() => {
      delete this._reelSpinTimeouts[colIndex];
      col.classList.remove('spinning');
      this.reelStop(colIndex);
    }, duration);
  }

  reelStop(colIndex) {
    const col = document.querySelectorAll('.reel-col')[colIndex];
    if (!col) return;
    // Cancel any pending stop timeout for this column before queuing a new one.
    clearTimeout(this._reelStopTimeouts[colIndex]);
    col.classList.add('stopping');
    this._reelStopTimeouts[colIndex] = setTimeout(() => {
      delete this._reelStopTimeouts[colIndex];
      col.classList.remove('stopping');
    }, 350);
  }

  reelSpinAll(numCols = 5, stopDelay = 300) {
    for (let i = 0; i < numCols; i++) {
      const spinDuration = 1200 + i * stopDelay;
      setTimeout(() => this.reelSpin(i, spinDuration), 0);
    }
  }

  reelStopAll(numCols = 5, stopDelay = 250) {
    for (let i = 0; i < numCols; i++) {
      setTimeout(() => this.reelStop(i), i * stopDelay);
    }
  }

  // ----------------------------------------------------------
  // COIN FLIP
  // ----------------------------------------------------------
  coinFlip(coinEl, result, onComplete) {
    if (!coinEl) { onComplete && onComplete(); return; }
    coinEl.classList.remove('heads-result', 'tails-result', 'flipping');

    // Force reflow
    void coinEl.offsetWidth;

    coinEl.classList.add('flipping');

    const duration = 1200;
    setTimeout(() => {
      coinEl.classList.remove('flipping');
      coinEl.classList.add(result === 'HEADS' ? 'heads-result' : 'tails-result');
      // Coin land particles
      const c = this._getElCenter(coinEl);
      this.createParticles({
        x: c.x, y: c.y,
        count: result === 'HEADS' ? 20 : 10,
        color: result === 'HEADS' ? '#FFD700' : '#888',
        size: 5,
        decay: 0.025,
        spread: 20,
        vyBase: -5, vxSpread: 10, vySpread: 4,
        glow: result === 'HEADS',
        glowColor: '#FFD700',
        shape: 'circle',
      });
      onComplete && onComplete();
    }, duration);
  }

  // ----------------------------------------------------------
  // WIN NUMBER COUNTER (visual)
  // ----------------------------------------------------------
  animateCounter(el, fromVal, toVal, duration = 1500, format) {
    if (!el) return;
    const startTime = performance.now();
    const diff = toVal - fromVal;
    const fmt = format || (v => v.toFixed(2));

    const tick = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out-expo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      el.textContent = fmt(fromVal + diff * eased);
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        el.textContent = fmt(toVal);
      }
    };
    requestAnimationFrame(tick);
  }

  // ----------------------------------------------------------
  // BACKGROUND SPARKLE (ambient)
  // ----------------------------------------------------------
  startAmbientSparkle(rate = 0.5) {
    if (this._sparkleInterval) return;
    this._sparkleInterval = setInterval(() => {
      if (Math.random() < rate) {
        this.particles.push(new Particle({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight * 0.6,
          vx: (Math.random() - 0.5) * 1.5,
          vy: -(0.5 + Math.random() * 2),
          ay: 0,
          life: 1.0,
          decay: 0.006 + Math.random() * 0.01,
          size: 2 + Math.random() * 4,
          color: ['#FFD700', '#FFE55C', '#FFF', '#00BFFF'][Math.floor(Math.random() * 4)],
          shape: 'star',
          glow: true,
          glowColor: '#FFD700',
        }));
      }
    }, 60);
  }

  stopAmbientSparkle() {
    if (this._sparkleInterval) {
      clearInterval(this._sparkleInterval);
      this._sparkleInterval = null;
    }
  }

  // ----------------------------------------------------------
  // CLEANUP
  // ----------------------------------------------------------
  clearParticles() {
    this.particles = [];
  }

  destroy() {
    this.stopAnimationLoop();
    this.stopAmbientSparkle();
    this.clearParticles();
    // Cancel every in-flight lightning arc animation frame.
    for (const handle of this._lightningRafs) {
      cancelAnimationFrame(handle);
    }
    this._lightningRafs.clear();
    // Cancel all pending reel spin/stop timeouts so callbacks never fire after
    // the engine has been destroyed.
    for (const id of Object.values(this._reelSpinTimeouts)) {
      clearTimeout(id);
    }
    this._reelSpinTimeouts = {};
    for (const id of Object.values(this._reelStopTimeouts)) {
      clearTimeout(id);
    }
    this._reelStopTimeouts = {};
  }
}

// ============================================================
// Export
// ============================================================
window.FXEngine = FXEngine;
console.log('[FXEngine] Module loaded');
