/**
 * Thunder Blessing — Prototype Main Logic
 * PrototypeRouter + Global Game State + 12 Screen Renderers + Spin Simulation
 */

'use strict';

// All mock data variables (GAME_CONFIG, SYMBOLS, REEL_POOL, etc.) are declared
// globally by mock-data.js — access them directly without destructuring.

// ============================================================
// GLOBAL GAME STATE
// ============================================================
let gameState = {
  balance: 1250.50,
  currency: 'USD',
  betIndex: 7,            // index into betLevelsUSD
  extraBetActive: false,
  sessionWin: 0,
  sessionSpins: 0,
  freeLetterProgress: 0,
  lightningMarks: [],
  fgActive: false,
  fgSpinsRemaining: 0,
  fgMultiplierLevel: 0,   // index into fgMultipliers
  fgTotalWin: 0,
  coinTossHeads: 0,
  rowCount: 3,
  currentWin: 0,
  totalWin: 0,
  lastResult: null,
  turboMode: false,
  autoPlay: false,
  cascadeStep: 0,
  grid: generateRandomGrid(5, 3),
  lastSpins: [],          // session history entries added during this session
  currentMultiplier: 1,
  sessionId: 'sess_mock_001',
  _winTier: 'normal',
};

function updateState(partial) {
  gameState = { ...gameState, ...partial };
}

// ============================================================
// HELPERS
// ============================================================
function fmt(amount) {
  return formatAmount(amount, gameState.currency);
}

function baseBet() { return getBaseBet(gameState); }
function totalBet() { return getTotalBet(gameState); }

function betLevels() {
  return gameState.currency === 'USD'
    ? GAME_CONFIG.betLevelsUSD
    : GAME_CONFIG.betLevelsTWD;
}

function currentBetStr() { return fmt(baseBet()); }
function totalBetStr()   { return fmt(totalBet()); }

// ============================================================
// SCREEN LABEL MAP
// ============================================================
const SCREEN_LABELS = {
  'screen-01': '01 · Loading',
  'screen-02': '02 · Lobby',
  'screen-03': '03 · Main Game — Idle',
  'screen-04': '04 · Main Game — Spinning',
  'screen-05': '05 · Cascade Animation',
  'screen-06': '06 · Thunder Blessing Trigger',
  'screen-07': '07 · Coin Toss',
  'screen-08': '08 · Free Game Active',
  'screen-09': '09 · Win Celebration',
  'screen-10': '10 · Buy Feature',
  'screen-11': '11 · Settings / Paytable',
  'screen-12': '12 · Session History',
};

// ============================================================
// PROTOTYPE ROUTER
// ============================================================
class PrototypeRouter {
  constructor() {
    this.screens   = {};
    this.history   = [];
    this.currentScreen = null;
  }

  register(id, renderer) {
    this.screens[id] = renderer;
  }

  navigate(id, options = {}) {
    const renderer = this.screens[id];
    if (!renderer) {
      console.warn('[Router] Unknown screen:', id);
      return;
    }

    const container = document.getElementById('proto-content');
    if (!container) return;

    // Deactivate current screen
    if (this.currentScreen) {
      const prev = document.getElementById(this.currentScreen);
      if (prev) {
        prev.classList.remove('active');
        prev.classList.add('hidden');
      }
    }

    // Render (or re-render) the target screen
    let el = document.getElementById(id);
    if (!el || options.forceRender) {
      const html = renderer();
      if (el) {
        el.outerHTML = html;
        el = document.getElementById(id);
      } else {
        container.insertAdjacentHTML('beforeend', html);
        el = document.getElementById(id);
      }
    }

    if (!el) return;

    // Activate
    el.classList.remove('hidden');
    el.classList.add('active');

    // History
    if (!options.replace && this.currentScreen !== id && this.currentScreen) {
      this.history.push(this.currentScreen);
    }
    this.currentScreen = id;

    // Update nav breadcrumb
    const breadcrumb = document.getElementById('proto-breadcrumb');
    if (breadcrumb) breadcrumb.textContent = SCREEN_LABELS[id] || id;

    const backBtn = document.getElementById('nav-back-btn');
    if (backBtn) backBtn.disabled = this.history.filter(Boolean).length === 0;

    // Run event binders
    const eventFn = this.screens[id + '_events'];
    if (typeof eventFn === 'function') eventFn();

    // Audio
    if (window.audioEngine && typeof window.audioEngine.bindToScreen === 'function') {
      window.audioEngine.bindToScreen(id);
    }

    // Scroll to top
    el.scrollTop = 0;
  }

  back() {
    const prev = this.history.pop();
    if (prev) this.navigate(prev, { replace: true });
  }

  init() {
    document.getElementById('nav-back-btn')
      ?.addEventListener('click', () => this.back());

    // nav-flow-btn uses inline onclick="showFlowMap()" in index.html — no duplicate listener needed

    document.getElementById('audio-unlock-btn')
      ?.addEventListener('click', async () => {
        if (!window.audioEngine) return;
        const ok = await window.audioEngine.unlock();
        if (ok) {
          document.getElementById('audio-unlock-btn')?.classList.add('hidden');
        }
      });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (!window.router) return;
      if (e.key === 'm' || e.key === 'M') showFlowMap();
      if (e.key === 'Escape') {
        const modal = document.getElementById('flow-map-modal');
        if (modal && window.getComputedStyle(modal).display !== 'none') {
          modal.classList.remove('open');
          modal.style.display = 'none';
        } else {
          window.router.back();
        }
      }
      // 1-9 jump to screen
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 9 && !e.ctrlKey && !e.metaKey && !e.altKey
          && document.activeElement.tagName !== 'INPUT') {
        window.router.navigate(`screen-0${n}`, { forceRender: true });
      }
      if (e.key === '0' && document.activeElement.tagName !== 'INPUT') {
        window.router.navigate('screen-10', { forceRender: true });
      }
    });
  }
}

// ============================================================
// TOAST UTILITY
// ============================================================
function showToast(message, durationMs = 2400) {
  let host = document.getElementById('proto-toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'proto-toast-host';
    host.style.cssText = 'position:fixed;top:56px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
    document.body.appendChild(host);
  }
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = 'padding:10px 18px;background:rgba(10,18,40,0.95);color:#FFD86B;border:1px solid rgba(255,216,107,0.4);border-radius:6px;font-size:14px;letter-spacing:0.5px;box-shadow:0 6px 24px rgba(0,0,0,0.4);opacity:0;transform:translateY(-8px);transition:opacity 200ms ease,transform 200ms ease;white-space:nowrap;';
  host.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-8px)';
    setTimeout(() => toast.remove(), 220);
  }, durationMs);
}

// ============================================================
// SHARED RENDERERS
// ============================================================

function renderGrid(grid, options = {}) {
  const rows = grid[0] ? grid[0].length : 3;
  const rowClass = rows >= 5 ? 'rows-6' : '';
  let html = `<div class="reel-container ${rowClass}" id="reel-container">`;
  for (let col = 0; col < grid.length; col++) {
    html += `<div class="reel-col" id="reel-col-${col}" data-reel="${col}">`;
    for (let row = 0; row < grid[col].length; row++) {
      const symId = grid[col][row];
      const sym   = SYMBOLS[symId] || SYMBOLS.L4;
      const isWin     = options.winPositions
        && options.winPositions.some(p => p[0] === col && p[1] === row);
      const hasLightning = (gameState.lightningMarks || [])
        .some(m => m[0] === col && m[1] === row);
      const classes = [
        'symbol-cell',
        isWin       ? 'win'        : '',
        sym.isWild  ? 'is-wild'    : '',
        sym.isScatter ? 'is-scatter' : '',
      ].filter(Boolean).join(' ');

      html += `
        <div class="${classes}" id="cell-${col}-${row}" data-col="${col}" data-row="${row}" data-sym="${symId}">
          <span class="symbol-emoji">${sym.emoji}</span>
          <span class="symbol-name">${sym.name}</span>
          ${hasLightning ? '<span class="lightning-mark">⚡</span>' : ''}
        </div>`;
    }
    html += '</div>';
  }
  html += '</div>';
  return html;
}

function renderFreeLetterBar(progress) {
  const letters = ['F', 'R', 'E', 'E'];
  return `
    <div class="free-letter-bar">
      <span class="free-letter-bar-label">FREE</span>
      ${letters.map((l, i) => `
        <div class="free-letter" data-lit="${i < progress}">${l}</div>
      `).join('')}
      <span style="font-size:9px;color:rgba(245,240,232,0.4);margin-left:8px;letter-spacing:1px;">
        ${progress >= 4 ? '→ COIN TOSS' : `${progress}/4`}
      </span>
    </div>`;
}

function renderFGMultBar(currentLevel, spinsLeft) {
  const mults = GAME_CONFIG.fgMultipliers;
  return `
    <div class="fg-mult-bar">
      <span class="fg-mult-bar-label">FG ×</span>
      <div class="fg-mult-nodes">
        ${mults.map((m, i) => {
          const reached = i < currentLevel;
          const current = i === currentLevel;
          const cls = reached ? 'reached' : current ? 'current' : '';
          return `
            <div class="fg-mult-node">
              <div class="fg-mult-dot ${cls}">${reached ? '✓' : current ? '★' : ''}</div>
              <div class="fg-mult-val ${cls}">×${m}</div>
            </div>`;
        }).join('')}
      </div>
      <span class="fg-spins-remaining">${spinsLeft} spins</span>
    </div>`;
}

function renderTopBar(options = {}) {
  const bal = fmt(gameState.balance);
  const win = gameState.currentWin > 0 ? fmt(gameState.currentWin) : '—';
  return `
    <div class="top-bar">
      <div class="top-bar-section">
        <span class="topbar-logo">⚡ THUNDER</span>
      </div>
      <div class="top-bar-section">
        <div class="topbar-stat">
          <span class="topbar-stat-label">餘額</span>
          <span class="topbar-stat-value" id="topbar-balance">${bal}</span>
        </div>
        <div class="topbar-stat">
          <span class="topbar-stat-label">WIN</span>
          <span class="topbar-stat-value ${gameState.currentWin > 0 ? 'win-glow' : ''}" id="topbar-win">${win}</span>
        </div>
        ${options.showSession ? `
        <div class="topbar-stat">
          <span class="topbar-stat-label">SESSION</span>
          <span class="topbar-stat-value">${fmt(gameState.sessionWin)}</span>
        </div>` : ''}
      </div>
      <div class="top-bar-section topbar-icon-btns">
        ${gameState.fgActive ? '' : '<button class="topbar-icon-btn" id="btn-buy-feature" title="Buy Feature">💰</button>'}
        <button class="topbar-icon-btn" id="btn-paytable" title="Paytable">📋</button>
        <button class="topbar-icon-btn" id="btn-settings" title="Settings">⚙️</button>
      </div>
    </div>`;
}

function renderHUD(options = {}) {
  const bet       = currentBetStr();
  const isSpinning= options.spinning || false;
  const isFG      = gameState.fgActive;
  const spinIcon  = isSpinning ? '⏸' : '▶';
  const spinLabel = isSpinning ? 'STOP' : isFG ? 'FG SPIN' : 'SPIN';
  const extraBadge= gameState.extraBetActive
    ? '<span class="hud-extra-bet-badge">+EXTRA</span>' : '';

  return `
    <div class="hud-bottom">
      <div class="hud-stat-group">
        <div class="hud-bet-control">
          <div class="hud-bet-row">
            <button class="hud-bet-arrow" id="btn-bet-down">−</button>
            <div style="display:flex;flex-direction:column;align-items:center;">
              <span class="hud-bet-value" id="hud-bet-val">${bet}</span>
              <span class="hud-bet-label">BET</span>
            </div>
            <button class="hud-bet-arrow" id="btn-bet-up">+</button>
          </div>
          <div style="display:flex;gap:4px;margin-top:3px;">
            <button class="btn-max" id="btn-max-bet">MAX</button>
            ${extraBadge}
          </div>
        </div>
      </div>

      <div class="spin-btn-wrap">
        <button class="btn-spin ${isSpinning ? 'spinning' : ''} ${isFG ? 'auto-mode' : ''}"
                id="btn-spin" ${isSpinning ? 'disabled' : ''}>
          <span class="spin-icon">${spinIcon}</span>
          <span class="spin-label">${spinLabel}</span>
        </button>
        <button class="btn-turbo ${gameState.turboMode ? 'active' : ''}" id="btn-turbo">⚡TURBO</button>
      </div>

      <div class="hud-stat-group">
        <div class="hud-stat">
          <span class="hud-stat-label">WIN</span>
          <span class="hud-stat-value ${gameState.currentWin > 0 ? 'win-glow' : ''}" id="hud-win-val">
            ${gameState.currentWin > 0 ? fmt(gameState.currentWin) : '—'}
          </span>
        </div>
        <div class="hud-stat">
          <span class="hud-stat-label">TOTAL BET</span>
          <span class="hud-stat-value" id="hud-totalbet-val">${totalBetStr()}</span>
        </div>
        <div class="hud-stat">
          <span class="hud-stat-label">LINES</span>
          <span class="hud-stat-value">57</span>
        </div>
      </div>
    </div>`;
}

// ============================================================
// SCREEN 01 — LOADING
// Zeus logo + animated progress bar, auto-navigates to screen-02
// ============================================================
function renderScreen01() {
  return `
    <div id="screen-01" class="screen hidden">
      <div class="loading-zeus-logo">
        <div class="zeus-emblem">⚡</div>
        <div class="loading-game-title">THUNDER<br>BLESSING</div>
        <div class="loading-game-subtitle">雷神賜福</div>
      </div>
      <div class="loading-progress-wrap">
        <div class="loading-bar-track">
          <div class="loading-bar-fill" id="loading-bar" style="width:0%"></div>
        </div>
        <div class="loading-pct" id="loading-pct">0%</div>
      </div>
      <div class="loading-tip" id="loading-tip">正在載入遊戲資源，請稍候…</div>
    </div>`;
}

function bindScreen01Events() {
  const tips = [
    '集滿 FREE 字母觸發 Coin Toss，解鎖最高 ×77 倍率！',
    '雷神祝福：5個以上 SC 符號引爆全盤雷霆！',
    '連鎖消除讓每一次旋轉都充滿無限可能。',
    '最高中獎倍率：30,000× BET · RTP 96.5%',
  ];
  const bar = document.getElementById('loading-bar');
  const pct = document.getElementById('loading-pct');
  const tip = document.getElementById('loading-tip');
  if (!bar) return;

  let progress = 0;
  let tipIdx   = 0;
  const iv = setInterval(() => {
    progress += Math.random() * 18 + 8;
    if (progress >= 100) progress = 100;
    bar.style.width = progress + '%';
    if (pct) pct.textContent = Math.floor(progress) + '%';
    if (tip && progress > 30 && tipIdx < tips.length) {
      tip.textContent = tips[Math.floor(tipIdx)];
      tipIdx += 0.5;
    }
    if (progress >= 100) {
      clearInterval(iv);
      setTimeout(() => router.navigate('screen-02'), 600);
    }
  }, 160);
}

// ============================================================
// SCREEN 02 — LOBBY
// Balance display, bet level selector, extra bet toggle,
// Buy Feature link → screen-10, START → screen-03
// ============================================================
function renderScreen02() {
  const bet    = currentBetStr();
  const bal    = fmt(gameState.balance);
  const buyCost= fmt(getBuyFeatureCost(gameState));
  const levels = betLevels();
  const pips   = Array.from({ length: Math.min(levels.length, 40) }, (_, i) =>
    `<div class="bet-pip ${i === gameState.betIndex ? 'active' : ''}"></div>`
  ).join('');

  return `
    <div id="screen-02" class="screen hidden"
         style="background:radial-gradient(ellipse 90% 70% at 50% 30%,#1e0d3a 0%,#0A0F1E 70%);align-items:center;overflow-y:auto;">
      <div class="lobby-header">
        <div style="font-size:52px;margin-bottom:4px;">⚡</div>
        <div class="lobby-title">THUNDER BLESSING</div>
        <div class="lobby-subtitle">雷神賜福 · 5×3 Cascade Slot · 57 Lines</div>
      </div>
      <div class="lobby-body scrollable">

        <div class="lobby-panel">
          <div class="lobby-panel-title">幣種 Currency</div>
          <div class="currency-toggle">
            <button class="currency-btn ${gameState.currency === 'USD' ? 'active' : ''}" id="cur-usd">🇺🇸 USD</button>
            <button class="currency-btn ${gameState.currency === 'TWD' ? 'active' : ''}" id="cur-twd">🇹🇼 TWD</button>
          </div>
        </div>

        <div class="lobby-panel">
          <div class="lobby-panel-title">投注額 Bet Amount</div>
          <div class="bet-selector-row">
            <button class="bet-arrow" id="lobby-bet-down">◀</button>
            <div class="bet-display">
              <div class="bet-amount" id="lobby-bet-display">${bet}</div>
              <div class="bet-label">Level ${gameState.betIndex + 1} / ${levels.length}</div>
            </div>
            <button class="bet-arrow" id="lobby-bet-up">▶</button>
          </div>
          <div class="bet-levels-indicator">${pips}</div>
        </div>

        <div class="lobby-panel">
          <div class="lobby-panel-title">附加功能</div>
          <div class="extra-bet-row">
            <div class="extra-bet-info">
              <div class="extra-bet-name">⚡ Extra Bet</div>
              <div class="extra-bet-desc">額外付費增加 SC 數量與 Lightning Mark 頻率</div>
            </div>
            <span class="extra-bet-cost">×3 BET</span>
            <label class="toggle-switch">
              <input type="checkbox" id="extra-bet-toggle" ${gameState.extraBetActive ? 'checked' : ''}>
              <div class="toggle-track"></div>
            </label>
          </div>
        </div>

        <div class="lobby-panel">
          <div class="lobby-panel-title">帳戶 Account</div>
          <div class="balance-row">
            <div>
              <div style="font-size:10px;color:rgba(245,240,232,0.45);letter-spacing:1px;text-transform:uppercase;">餘額 Balance</div>
              <div class="balance-val" id="lobby-balance">${bal}</div>
            </div>
            <span class="buy-feature-link" id="lobby-buy-feature">購買自由遊戲 (${buyCost})</span>
          </div>
        </div>

        <button class="lobby-start-btn" id="lobby-start-btn">START 開始遊戲</button>

        <div style="text-align:center;margin-top:8px;">
          <span style="font-size:10px;color:rgba(245,240,232,0.3);">
            RTP 96.5% · Max Win 30,000× · 負責任博弈
          </span>
        </div>
      </div>
    </div>`;
}

function bindScreen02Events() {
  const betDisplay = document.getElementById('lobby-bet-display');
  function refreshBet() {
    if (betDisplay) betDisplay.textContent = currentBetStr();
    document.querySelectorAll('.bet-pip').forEach((p, i) => {
      p.classList.toggle('active', i === gameState.betIndex);
    });
  }

  document.getElementById('lobby-bet-down')?.addEventListener('click', () => {
    if (gameState.betIndex > 0) {
      updateState({ betIndex: gameState.betIndex - 1 });
      refreshBet();
    }
  });
  document.getElementById('lobby-bet-up')?.addEventListener('click', () => {
    const max = betLevels().length - 1;
    if (gameState.betIndex < max) {
      updateState({ betIndex: gameState.betIndex + 1 });
      refreshBet();
    }
  });
  document.getElementById('cur-usd')?.addEventListener('click', () => {
    updateState({ currency: 'USD' });
    router.navigate('screen-02', { forceRender: true });
  });
  document.getElementById('cur-twd')?.addEventListener('click', () => {
    updateState({ currency: 'TWD' });
    router.navigate('screen-02', { forceRender: true });
  });
  document.getElementById('extra-bet-toggle')?.addEventListener('change', (e) => {
    updateState({ extraBetActive: e.target.checked });
  });
  document.getElementById('lobby-start-btn')?.addEventListener('click', () => {
    if (window.audioEngine) window.audioEngine.playSFX('SFX-BUTTON');
    router.navigate('screen-03');
  });
  document.getElementById('lobby-buy-feature')?.addEventListener('click', () => {
    router.navigate('screen-10');
  });
}

// ============================================================
// SCREEN 03 — MAIN GAME (Idle)
// 5×3 slot grid, win/bet display, SPIN button
// ============================================================
function renderScreen03() {
  return `
    <div id="screen-03" class="screen game-scene hidden">
      ${renderTopBar()}
      <div class="game-area">
        ${renderFreeLetterBar(gameState.freeLetterProgress)}
        <div class="reel-frame" id="reel-frame">
          <div class="reel-frame-glow" id="reel-glow"></div>
          ${renderGrid(gameState.grid, { winPositions: gameState.lastResult ? gameState.lastResult.winPositions : [] })}
          <div class="win-line-overlay" id="win-overlay"></div>
        </div>
        ${gameState.currentWin > 0 ? `
          <div class="win-amount-popup" id="win-popup">+${fmt(gameState.currentWin)}</div>
        ` : ''}
      </div>
      ${renderHUD()}
    </div>`;
}

function bindScreen03Events() {
  bindGameHUDEvents();
}

// ============================================================
// SCREEN 04 — SPINNING
// Shows spinning state; resolves after 2s (1s in turbo)
// ============================================================
function renderScreen04() {
  const spinGrid = generateRandomGrid(5, gameState.rowCount);
  return `
    <div id="screen-04" class="screen game-scene hidden">
      ${renderTopBar()}
      <div class="game-area">
        ${renderFreeLetterBar(gameState.freeLetterProgress)}
        <div class="reel-frame" id="reel-frame">
          <div class="reel-frame-glow active"></div>
          ${renderGrid(spinGrid)}
          <div style="position:absolute;top:8px;left:50%;transform:translateX(-50%);">
            <span class="state-badge cascade"
                  style="background:rgba(255,215,0,0.15);color:var(--color-gold-bright);border-color:var(--color-gold-bright);">
              ⚡ SPINNING…
            </span>
          </div>
        </div>
      </div>
      ${renderHUD({ spinning: true })}
    </div>`;
}

function bindScreen04Events() {
  // Animate reel columns
  document.querySelectorAll('.reel-col').forEach((col, i) => {
    setTimeout(() => col.classList.add('spinning'), i * 60);
  });

  const spinDelay = gameState.turboMode ? 900 : 2000;

  // Stagger reel stops
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      if (window.fxEngine) window.fxEngine.reelStop(i);
      if (window.audioEngine) window.audioEngine.playSFX('SFX-REEL-STOP');
    }, spinDelay + i * 120);
  }

  // Resolve after all reels stop
  setTimeout(() => resolveSpinResult(), spinDelay + 5 * 120 + 100);
}

// ============================================================
// SCREEN 05 — CASCADE ANIMATION
// Animated sequence: eliminate winning symbols, drop new ones,
// then navigate to screen-06 if Thunder Blessing triggered
// ============================================================
function renderScreen05() {
  const result  = gameState.lastResult || {};
  const step    = gameState.cascadeStep;
  const cascade = result.cascades && result.cascades[step];
  const winPos  = cascade ? cascade.eliminated || [] : [];

  return `
    <div id="screen-05" class="screen game-scene hidden">
      ${renderTopBar()}
      <div class="game-area">
        ${renderFreeLetterBar(gameState.freeLetterProgress)}
        <div class="reel-frame" id="reel-frame" style="position:relative;">
          <div class="reel-frame-glow active"></div>
          ${renderGrid(gameState.grid, { winPositions: winPos })}
          <div class="cascade-counter" id="cascade-counter">
            ⚡ CASCADE ×${step + 1} &nbsp;+${fmt(cascade ? cascade.stepWin || 0 : 0)}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
          <span class="state-badge cascade">CASCADE 連鎖 ×${step + 1}</span>
          <span style="font-size:12px;color:var(--color-gold-bright);font-family:Orbitron,sans-serif;">
            WIN: ${fmt(gameState.currentWin)}
          </span>
        </div>
      </div>
      ${renderHUD({ spinning: true })}
    </div>`;
}

function bindScreen05Events() {
  const result = gameState.lastResult;
  if (!result || !result.cascades) { finishCascades(); return; }

  const step    = gameState.cascadeStep;
  const cascade = result.cascades[step];
  if (!cascade)  { finishCascades(); return; }

  if (window.audioEngine) window.audioEngine.playSFX('SFX-CASCADE');

  // Animate eliminating cells
  (cascade.eliminated || []).forEach(([col, row]) => {
    const cell = document.getElementById(`cell-${col}-${row}`);
    if (cell) cell.classList.add('exploding');
  });

  const delay = gameState.turboMode ? 600 : 1100;
  setTimeout(() => {
    const stepWin = cascade.stepWin || 0;
    updateState({
      currentWin:         gameState.currentWin + stepWin,
      balance:            gameState.balance + stepWin,
      cascadeStep:        step + 1,
      freeLetterProgress: Math.min(4, gameState.freeLetterProgress + (cascade.freeLetterDelta || 0)),
    });
    // Drop new symbols (visual only; use existing grid)
    if (window.fxEngine) {
      document.querySelectorAll('.symbol-cell:not(.exploding)').forEach((cell, i) => {
        window.fxEngine.symbolDrop(cell, i * 30);
      });
    }

    const nextCascade = result.cascades[gameState.cascadeStep];
    if (nextCascade) {
      router.navigate('screen-05', { forceRender: true });
    } else {
      finishCascades();
    }
  }, delay);
}

function finishCascades() {
  if (gameState.lastResult && gameState.lastResult.isThunderBlessing) {
    router.navigate('screen-06', { forceRender: true });
    return;
  }
  if (gameState.freeLetterProgress >= 4) {
    updateState({ freeLetterProgress: 0, coinTossHeads: 0 });
    setTimeout(() => router.navigate('screen-07'), 600);
    return;
  }
  if (gameState.currentWin >= totalBet() * 5) {
    showWinOverlay(gameState.currentWin);
    return;
  }
  setTimeout(() => {
    updateState({ cascadeStep: 0 });
    router.navigate('screen-03', { forceRender: true });
  }, 700);
}

// ============================================================
// SCREEN 06 — THUNDER BLESSING TRIGGER
// Full-screen lightning overlay, Zeus imagery, auto-navigates
// to screen-07 (Coin Toss) after countdown
// ============================================================
function renderScreen06() {
  const result = gameState.lastResult || {};
  const scGrid = result.grid || gameState.grid;

  return `
    <div id="screen-06" class="screen game-scene hidden">
      ${renderTopBar()}
      <div class="game-area" style="position:relative;">
        ${renderFreeLetterBar(Math.min(4, gameState.freeLetterProgress))}
        <div class="reel-frame" id="reel-frame" style="position:relative;">
          <div class="reel-frame-glow active"></div>
          ${renderGrid(scGrid)}
          <div class="thunder-blessing-overlay" id="thunder-overlay">
            <div style="font-size:64px;filter:drop-shadow(0 0 20px #FFD700);animation:zeus-glow 2s ease-in-out infinite;">⚡</div>
            <div class="thunder-blessing-title">⚡ THUNDER BLESSING ⚡</div>
            <div class="thunder-blessing-sub">雷霆祝福 · SC 引爆</div>
            <div style="font-size:48px;margin-top:8px;opacity:0.7;">🌩 ZEUS 🌩</div>
            <div id="thunder-countdown"
                 style="font-family:Orbitron,sans-serif;font-size:28px;color:var(--color-gold-divine);margin-top:12px;min-height:40px;text-shadow:0 0 20px #FFD700;">
            </div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
          <span class="state-badge thunder">⚡ THUNDER BLESSING</span>
          ${result.thunderBlessingWin
            ? `<span style="font-size:12px;color:var(--color-gold-divine);font-family:Orbitron,sans-serif;">WIN: ${fmt(result.thunderBlessingWin)}</span>`
            : ''}
        </div>
      </div>
      ${renderHUD({ spinning: true })}
    </div>`;
}

function bindScreen06Events() {
  if (window.audioEngine) window.audioEngine.playThunderBlessingSequence();
  if (window.fxEngine) {
    window.fxEngine.lightningFlash();
    const scatterEls = Array.from(document.querySelectorAll('.symbol-cell.is-scatter'));
    if (scatterEls.length) window.fxEngine.thunderBlessingBurst(scatterEls);
  }

  const totalDelay = gameState.turboMode ? 1500 : 3000;

  // Countdown 3-2-1
  const cdEl = document.getElementById('thunder-countdown');
  let count = 3;
  const cdIv = setInterval(() => {
    if (!cdEl) { clearInterval(cdIv); return; }
    cdEl.textContent = count > 0 ? count : '';
    count--;
    if (count < 0) clearInterval(cdIv);
  }, totalDelay / 4);

  setTimeout(() => {
    const bonus = (gameState.lastResult && gameState.lastResult.thunderBlessingWin)
      ? gameState.lastResult.thunderBlessingWin : 50;
    updateState({
      currentWin:         gameState.currentWin + bonus,
      balance:            gameState.balance + bonus,
      freeLetterProgress: Math.min(4, gameState.freeLetterProgress + 2),
    });
    if (gameState.freeLetterProgress >= 4) {
      updateState({ freeLetterProgress: 0, coinTossHeads: 0 });
      router.navigate('screen-07');
    } else {
      updateState({ cascadeStep: 0 });
      router.navigate('screen-03', { forceRender: true });
    }
  }, totalDelay);
}

// ============================================================
// SCREEN 07 — COIN TOSS
// Large 3-D flipping coin, ×1 or ×2 multiplier result,
// confirm → screen-08
// ============================================================
function renderScreen07() {
  const heads = gameState.coinTossHeads;
  const mults = GAME_CONFIG.fgMultipliers;
  const probs = GAME_CONFIG.coinProbs;

  const headsTrack = Array.from({ length: 5 }, (_, i) => `
    <div class="coin-toss-head-pip ${i < heads ? 'filled' : ''}">
      ${i < heads ? '⚡' : ''}
    </div>`).join('');

  const multRow = mults.map((m, i) => {
    const cls = i < heads ? 'unlocked' : i === heads ? 'current' : '';
    return `
      <div class="coin-toss-mult-item ${cls}">
        <div class="mult-val">×${m}</div>
        <div class="mult-heads">${probs[i] != null ? Math.round(probs[i] * 100) + '%' : '—'}</div>
      </div>`;
  }).join('');

  const currentMult = mults[Math.max(0, heads - 1)] || '—';
  const nextMult    = mults[heads] || '—';

  return `
    <div id="screen-07" class="screen hidden">
      <div class="coin-toss-container">
        <div class="coin-toss-title">⚡ COIN TOSS ⚡</div>
        <div class="coin-toss-subtitle">
          ${heads === 0 ? '翻轉硬幣，解鎖自由遊戲倍率！' :
            heads >= 5  ? '🎉 恭喜！達成最高倍率 ×77！' :
            `連續 ${heads} 次 HEADS！下次機率：${probs[heads] != null ? Math.round(probs[heads] * 100) : 0}%`}
        </div>

        <div class="coin-wrap">
          <div class="coin" id="toss-coin">
            <div class="coin-face heads">
              <span class="coin-face-emoji">⚡</span>
              <span class="coin-face-label">HEADS</span>
            </div>
            <div class="coin-face tails">
              <span class="coin-face-emoji">🌑</span>
              <span class="coin-face-label">TAILS</span>
            </div>
          </div>
        </div>

        <div id="coin-result-display"
             style="min-height:44px;display:flex;align-items:center;justify-content:center;">
          ${heads > 0
            ? `<div class="coin-result-text heads">HEADS ×${heads}</div>`
            : '<div style="font-size:13px;color:rgba(245,240,232,0.4);">翻轉硬幣決定倍率</div>'}
        </div>

        <div class="coin-toss-progress">
          <div class="coin-toss-progress-title">HEADS 進度 (5次 = ×77)</div>
          <div class="coin-toss-heads-track">${headsTrack}</div>
        </div>

        <div class="coin-toss-mult-row">${multRow}</div>

        <div style="text-align:center;font-size:11px;color:rgba(245,240,232,0.5);">
          ${heads === 0
            ? `當前：— &nbsp;→&nbsp; 下一：<b style="color:var(--color-fg-blue)">×${nextMult}</b>`
            : heads >= 5
              ? `🏆 最高倍率 <b style="color:var(--color-gold-bright)">×77</b> 已達成`
              : `當前：<b style="color:var(--color-fg-blue)">×${currentMult}</b> &nbsp;→&nbsp; 下一：<b style="color:var(--color-gold-bright)">×${nextMult}</b>`}
        </div>

        <button class="btn-toss" id="btn-toss" ${heads >= 5 ? 'disabled' : ''}>
          ${heads >= 5 ? '🎉 進入自由遊戲 ×77' : `翻轉硬幣 (HEADS 機率 ${probs[heads] != null ? Math.round(probs[heads] * 100) : 0}%)`}
        </button>
        ${heads >= 5 ? `
        <button class="btn-toss" id="btn-enter-fg"
                style="background:var(--color-fg-blue);color:#000;margin-top:-4px;">
          ▶ 進入自由遊戲
        </button>` : ''}
      </div>
    </div>`;
}

function bindScreen07Events() {
  document.getElementById('btn-toss')?.addEventListener('click', handleCoinToss);
  document.getElementById('btn-enter-fg')?.addEventListener('click', enterFreeGame);
}

function handleCoinToss() {
  const heads = gameState.coinTossHeads;
  const prob  = GAME_CONFIG.coinProbs[heads] ?? 0;
  const result = Math.random() < prob ? 'HEADS' : 'TAILS';

  const coinEl = document.getElementById('toss-coin');
  const btn    = document.getElementById('btn-toss');
  if (btn) btn.disabled = true;

  if (window.audioEngine) window.audioEngine.playCoinFlip();

  if (window.fxEngine) {
    window.fxEngine.coinFlip(coinEl, result, () => processCoinResult(result));
  } else {
    setTimeout(() => processCoinResult(result), 3200);
  }
}

function processCoinResult(result) {
  const display = document.getElementById('coin-result-display');

  if (result === 'HEADS') {
    if (window.audioEngine) window.audioEngine.playSFX('SFX-COIN-HEADS');
    const newHeads = gameState.coinTossHeads + 1;
    updateState({
      coinTossHeads:     newHeads,
      fgMultiplierLevel: Math.min(newHeads - 1, GAME_CONFIG.fgMultipliers.length - 1),
    });
    if (newHeads >= 5) {
      if (window.audioEngine) window.audioEngine.playBGM('BGM_77X');
      setTimeout(() => router.navigate('screen-07', { forceRender: true }), 400);
      return;
    }
    setTimeout(() => router.navigate('screen-07', { forceRender: true }), 600);
  } else {
    if (window.audioEngine) window.audioEngine.playSFX('SFX-COIN-TAILS');
    if (display) display.innerHTML = '<div class="coin-result-text tails">TAILS</div>';
    const level = Math.max(0, gameState.coinTossHeads - 1);
    updateState({ fgMultiplierLevel: level });
    setTimeout(() => enterFreeGame(), 1200);
  }
}

function enterFreeGame() {
  updateState({
    fgActive:          true,
    fgSpinsRemaining:  GAME_CONFIG.fgSpinsPerRound,
    fgTotalWin:        0,
    currentWin:        0,
    coinTossHeads:     0,
  });
  router.navigate('screen-08');
}

// ============================================================
// SCREEN 08 — FREE GAME ACTIVE
// Like main game but with FG banner, multiplier bar,
// and spins countdown; auto-completes when spins reach 0
// ============================================================
function renderScreen08() {
  const multLevel = gameState.fgMultiplierLevel;
  const mult      = GAME_CONFIG.fgMultipliers[multLevel] || 3;
  const spinsLeft = gameState.fgSpinsRemaining;

  return `
    <div id="screen-08" class="screen game-scene hidden"
         style="background:radial-gradient(ellipse 100% 80% at 50% 20%,#003366 0%,#0A0F1E 60%);">
      ${renderTopBar({ showSession: true })}
      <div class="fg-scene-banner">
        <span class="fg-scene-label">⚡ FREE GAME</span>
        <div style="display:flex;flex-direction:column;align-items:center;">
          <span class="fg-scene-multiplier">×${mult}</span>
          <span style="font-size:9px;color:rgba(0,191,255,0.5);letter-spacing:2px;">MULTIPLIER</span>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;">
          <span class="fg-total-win-label">FG 累計</span>
          <span class="fg-total-win-val" id="fg-total-val">${fmt(gameState.fgTotalWin)}</span>
        </div>
      </div>
      ${renderFGMultBar(multLevel, spinsLeft)}
      <div class="game-area">
        ${renderFreeLetterBar(gameState.freeLetterProgress)}
        <div class="reel-frame" id="reel-frame"
             style="border-color:rgba(0,191,255,0.5);box-shadow:0 0 30px rgba(0,191,255,0.2);">
          <div class="reel-frame-glow" style="box-shadow:0 0 20px rgba(0,191,255,0.4)"></div>
          ${renderGrid(gameState.grid)}
        </div>
        ${spinsLeft <= 0 ? `
        <div style="margin-top:12px;">
          <span class="state-badge free-game">🎯 FREE GAME 結束</span>
        </div>` : ''}
      </div>
      ${renderHUD({ spinning: false })}
    </div>`;
}

function bindScreen08Events() {
  if (window.audioEngine) window.audioEngine.playBGM('BGM_FG', { force: true });

  document.getElementById('btn-spin')?.addEventListener('click', handleFGSpin);
  document.getElementById('btn-paytable')?.addEventListener('click', () => router.navigate('screen-11'));
  document.getElementById('btn-settings')?.addEventListener('click', () => router.navigate('screen-11'));
  bindBetControls();
}

function handleFGSpin() {
  if (gameState.fgSpinsRemaining <= 0) { endFreeGame(); return; }

  const bet     = totalBet();
  const baseWin = bet * (Math.random() * 8 + 1);
  const mult    = GAME_CONFIG.fgMultipliers[gameState.fgMultiplierLevel] || 3;
  const spinWin = baseWin * mult;
  const newGrid = generateRandomGrid(5, gameState.rowCount);

  updateState({
    fgSpinsRemaining: gameState.fgSpinsRemaining - 1,
    grid:             newGrid,
    currentWin:       spinWin,
    balance:          gameState.balance + spinWin,
    fgTotalWin:       gameState.fgTotalWin + spinWin,
    sessionWin:       gameState.sessionWin + spinWin,
  });

  if (window.audioEngine) window.audioEngine.playSFX('SFX-WIN-SMALL');
  router.navigate('screen-08', { forceRender: true });

  if (gameState.fgSpinsRemaining <= 0) {
    setTimeout(() => endFreeGame(), 1200);
  }
}

function endFreeGame() {
  const totalFGWin = gameState.fgTotalWin;
  updateState({ fgActive: false, fgMultiplierLevel: 0, fgTotalWin: 0, fgSpinsRemaining: 0 });

  const tier = totalFGWin >= totalBet() * 50 ? 'ultra'
             : totalFGWin >= totalBet() * 15 ? 'mega'
             : totalFGWin >= totalBet() * 5  ? 'big'
             : 'normal';
  showWinOverlay(totalFGWin, tier);
}

// ============================================================
// SCREEN 09 — WIN CELEBRATION
// Full-screen overlay: BIG WIN / MEGA WIN / ULTRA WIN text,
// animated counter, gold coin burst via fxEngine.coinBurst()
// ============================================================
function renderScreen09() {
  const tier    = gameState._winTier || 'big';
  const amount  = gameState.currentWin || 0;
  const tierCfg = Object.values(GAME_CONFIG.winTiers).find(t => t.tier === tier)
                  || GAME_CONFIG.winTiers.big;

  const bannerClass = tier === 'maxwin' ? 'max-win'
                    : tier === 'ultra'  ? 'jackpot-win'
                    : tier === 'mega'   ? 'mega-win'
                    : 'big-win';

  const stars = '⭐'.repeat(tierCfg.stars || 2);

  return `
    <div id="screen-09" class="screen hidden">
      <div class="win-starburst"></div>
      <div class="win-overlay-container">
        <div class="win-tier-banner ${bannerClass}">${tierCfg.label}</div>
        <div class="win-stars-row">${stars}</div>
        <div class="win-amount-display" id="win-counter-display">${fmt(amount)}</div>
        <div class="win-subtitle">TOTAL WIN · 恭喜中獎</div>
        <button class="btn-collect" id="btn-collect-win">COLLECT 領取</button>
      </div>
    </div>`;
}

function bindScreen09Events() {
  const tier   = gameState._winTier || 'big';
  const amount = gameState.currentWin || 0;

  if (window.audioEngine) {
    window.audioEngine.playWinSound(tier);
  }

  // Animated counter roll-up
  const counterEl = document.getElementById('win-counter-display');
  if (counterEl && window.fxEngine) {
    const sym = gameState.currency === 'USD' ? '$' : 'NT$';
    const dec = gameState.currency === 'USD' ? 2 : 0;
    window.fxEngine.animateCounter(counterEl, 0, amount, 1800,
      v => `${sym}${dec === 0 ? Math.round(v).toLocaleString() : v.toFixed(dec)}`);
  }

  // Coin burst from center screen
  if (window.fxEngine) {
    window.fxEngine.coinBurst(window.innerWidth / 2, window.innerHeight * 0.4, 60);
    window.fxEngine.goldCoinRain(window.innerWidth / 2, 0, 50);
  }

  // Record spin in lastSpins
  const spinRecord = {
    spinId: `spin-${Date.now()}`,
    bet:    totalBet(),
    win:    amount,
    result: tier === 'normal' ? 'WIN' : tier.toUpperCase(),
    time:   new Date().toTimeString().slice(0, 8),
    tier,
  };
  updateState({ lastSpins: [spinRecord, ...gameState.lastSpins].slice(0, 10) });

  document.getElementById('btn-collect-win')?.addEventListener('click', () => {
    updateState({ currentWin: 0, cascadeStep: 0 });
    if (gameState.fgActive) {
      router.navigate('screen-08', { forceRender: true });
    } else {
      router.navigate('screen-03', { forceRender: true });
    }
  });
}

function showWinOverlay(amount, tierOverride) {
  const tier = tierOverride || classifyWin(amount, totalBet()).tier;
  updateState({ _winTier: tier, currentWin: amount });
  router.navigate('screen-09', { forceRender: true });
}

// ============================================================
// SCREEN 10 — BUY FEATURE
// Shows cost (100× betAmount), balance check, confirm → screen-07
// ============================================================
function renderScreen10() {
  const costFull = fmt(getBuyFeatureCost(gameState));
  const costHalf = fmt(getBuyFeatureCost(gameState) * 0.5);

  return `
    <div id="screen-10" class="screen hidden">
      <div class="buy-feature-dialog">
        <div class="dialog-header">
          <div class="dialog-title">⚡ 購買自由遊戲</div>
          <div class="dialog-subtitle">Buy Feature · 直接進入 Coin Toss</div>
        </div>

        <div class="buy-feature-options">
          <div class="buy-option-card selected" id="buy-opt-100" data-opt="100">
            <div>
              <div class="buy-option-name">⚡ 標準購買 (100× BET)</div>
              <div class="buy-option-desc">保證5次 Coin Toss · 有機會達成 ×77 倍率</div>
            </div>
            <div class="buy-option-price">${costFull}</div>
          </div>
          <div class="buy-option-card" id="buy-opt-50" data-opt="50">
            <div>
              <div class="buy-option-name">🌙 折扣購買 (50× BET)</div>
              <div class="buy-option-desc">已有2次 HEADS · 最高倍率 ×17</div>
            </div>
            <div class="buy-option-price">${costHalf}</div>
          </div>
        </div>

        <div class="divider"></div>
        <div style="display:flex;justify-content:space-between;font-size:11px;color:rgba(245,240,232,0.5);margin-bottom:12px;">
          <span>當前餘額</span>
          <span style="color:var(--color-gold-bright);">${fmt(gameState.balance)}</span>
        </div>

        <div class="dialog-confirm-row">
          <button class="btn-dialog-cancel" id="btn-buy-cancel">取消</button>
          <button class="btn-dialog-confirm" id="btn-buy-confirm">確認購買</button>
        </div>
        <div class="dialog-warning">
          ⚠️ 本功能消耗遊戲餘額。購買後無法退款。請負責任博弈。
        </div>
      </div>
    </div>`;
}

function bindScreen10Events() {
  let selectedOpt = 100;

  document.querySelectorAll('.buy-option-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.buy-option-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedOpt = parseInt(card.dataset.opt, 10);
    });
  });

  document.getElementById('btn-buy-cancel')?.addEventListener('click', () => router.back());

  document.getElementById('btn-buy-confirm')?.addEventListener('click', () => {
    const cost = baseBet() * selectedOpt;
    if (gameState.balance < cost) {
      showToast('⚠️ 餘額不足，請降低投注額');
      return;
    }
    if (window.audioEngine) window.audioEngine.playSFX('SFX-BUY');
    updateState({
      balance:          gameState.balance - cost,
      coinTossHeads:    selectedOpt === 50 ? 2 : 0,
      fgMultiplierLevel: selectedOpt === 50 ? 1 : 0,
    });
    router.navigate('screen-07', { forceRender: true });
  });
}

// ============================================================
// SCREEN 11 — SETTINGS / PAYTABLE
// BGM volume, SFX volume, turbo mode, game speed, back button
// Also includes full paytable when "Paytable" tab is active
// ============================================================
function renderScreen11() {
  const bgmPct = Math.round((window.audioEngine?._bgmVol ?? 0.7) * 100);
  const sfxPct = Math.round((window.audioEngine?._sfxVol ?? 0.8) * 100);

  const highSyms = PAYTABLE.highSymbols.map(s => renderPaytableCard(s)).join('');
  const lowSyms  = PAYTABLE.lowSymbols.map(s => renderPaytableCard(s)).join('');
  const features = PAYTABLE.features.map(f => `
    <div class="feature-card">
      <div class="feature-card-title">${f.title}</div>
      <div class="feature-card-desc">${f.desc}</div>
      ${f.rules ? `<ul class="feature-card-list">${f.rules.map(r => `<li>${r}</li>`).join('')}</ul>` : ''}
    </div>`).join('');

  return `
    <div id="screen-11" class="screen hidden" style="background:rgba(10,15,30,0.97);">
      <div class="paytable-header">
        <div class="paytable-title">⚙️ 設定 &amp; 賠率表</div>
      </div>
      <button class="paytable-close-btn" id="paytable-close-btn">✕</button>

      <div class="paytable-tabs">
        <div class="paytable-tab active" data-tab="settings">設定</div>
        <div class="paytable-tab" data-tab="symbols">符號賠率</div>
        <div class="paytable-tab" data-tab="features">功能說明</div>
      </div>

      <div class="paytable-body scrollable" id="paytable-body">
        <!-- SETTINGS TAB -->
        <div id="paytable-tab-settings">
          <div class="paytable-section-title">音效設定 Audio</div>
          <div style="display:flex;flex-direction:column;gap:14px;margin-bottom:16px;">

            <div style="display:flex;align-items:center;gap:12px;">
              <span style="font-size:12px;color:var(--color-arc-white);min-width:80px;">🎵 BGM音量</span>
              <input type="range" id="bgm-vol" min="0" max="100" value="${bgmPct}"
                     style="flex:1;accent-color:var(--color-gold-primary);">
              <span style="font-size:12px;color:var(--color-gold-bright);min-width:36px;text-align:right;"
                    id="bgm-vol-val">${bgmPct}%</span>
            </div>

            <div style="display:flex;align-items:center;gap:12px;">
              <span style="font-size:12px;color:var(--color-arc-white);min-width:80px;">🔊 SFX音量</span>
              <input type="range" id="sfx-vol" min="0" max="100" value="${sfxPct}"
                     style="flex:1;accent-color:var(--color-gold-primary);">
              <span style="font-size:12px;color:var(--color-gold-bright);min-width:36px;text-align:right;"
                    id="sfx-vol-val">${sfxPct}%</span>
            </div>
          </div>

          <div class="paytable-section-title">遊戲設定 Gameplay</div>
          <div style="display:flex;flex-direction:column;gap:12px;">

            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div>
                <div style="font-size:13px;color:var(--color-arc-white);font-weight:600;">⚡ Turbo Mode</div>
                <div style="font-size:11px;color:rgba(245,240,232,0.45);">縮短旋轉動畫時間</div>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" id="turbo-toggle" ${gameState.turboMode ? 'checked' : ''}>
                <div class="toggle-track"></div>
              </label>
            </div>

            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div>
                <div style="font-size:13px;color:var(--color-arc-white);font-weight:600;">🎮 遊戲速度</div>
                <div style="font-size:11px;color:rgba(245,240,232,0.45);">Normal / Fast / Turbo</div>
              </div>
              <select id="speed-select"
                      style="background:rgba(27,42,74,0.8);color:var(--color-gold-bright);border:1px solid rgba(220,163,49,0.4);border-radius:6px;padding:6px 10px;font-size:12px;">
                <option value="normal" ${!gameState.turboMode ? 'selected' : ''}>Normal</option>
                <option value="fast">Fast</option>
                <option value="turbo" ${gameState.turboMode ? 'selected' : ''}>Turbo</option>
              </select>
            </div>

          </div>

          <div class="paytable-section-title" style="margin-top:16px;">本局記錄</div>
          <button id="btn-session-history"
                  style="width:100%;padding:10px;background:rgba(220,163,49,0.15);border:1px solid rgba(220,163,49,0.4);border-radius:8px;color:var(--color-gold-bright);font-size:13px;font-weight:600;cursor:pointer;margin-bottom:12px;">
            📋 查看旋轉記錄 (${gameState.lastSpins.length} 筆)
          </button>

          <div class="paytable-section-title">遊戲資訊</div>
          <div style="display:flex;flex-direction:column;gap:6px;font-size:11px;color:rgba(245,240,232,0.5);">
            <div style="display:flex;justify-content:space-between;">
              <span>RTP</span><span style="color:var(--color-gold-bright);">96.5%</span>
            </div>
            <div style="display:flex;justify-content:space-between;">
              <span>最高倍率</span><span style="color:var(--color-gold-bright);">30,000×</span>
            </div>
            <div style="display:flex;justify-content:space-between;">
              <span>連線數</span><span style="color:var(--color-gold-bright);">57</span>
            </div>
            <div style="display:flex;justify-content:space-between;">
              <span>版本</span><span style="color:var(--color-gold-bright);">1.0.0-prototype</span>
            </div>
            <div style="display:flex;justify-content:space-between;">
              <span>Session ID</span><span style="color:rgba(245,240,232,0.4);font-size:10px;">${gameState.sessionId}</span>
            </div>
          </div>
        </div>

        <!-- SYMBOLS TAB -->
        <div id="paytable-tab-symbols" style="display:none;">
          <div class="paytable-section-title">高價值符號</div>
          <div class="paytable-grid">${highSyms}</div>
          <div class="paytable-section-title">低價值符號</div>
          <div class="paytable-grid">${lowSyms}</div>
          <div class="paytable-section-title">特殊符號</div>
          <div class="paytable-grid">
            <div class="paytable-card">
              <div class="paytable-symbol-icon">⚡</div>
              <div class="paytable-symbol-info">
                <div class="paytable-symbol-name">Wild 替換符號</div>
                <div class="paytable-payouts"><div class="paytable-payout-row"><span class="combo">替換除 SC 外所有符號</span></div></div>
              </div>
            </div>
            <div class="paytable-card">
              <div class="paytable-symbol-icon">⚙️</div>
              <div class="paytable-symbol-info">
                <div class="paytable-symbol-name">Scatter SC</div>
                <div class="paytable-payouts"><div class="paytable-payout-row"><span class="combo">3+ 觸發 Thunder Blessing</span></div></div>
              </div>
            </div>
          </div>
        </div>

        <!-- FEATURES TAB -->
        <div id="paytable-tab-features" style="display:none;">${features}</div>
      </div>
    </div>`;
}

function renderPaytableCard(sym) {
  const payouts = sym.payouts || {};
  const rows = [3, 4, 5].filter(n => payouts[n]).map(n =>
    `<div class="paytable-payout-row">
      <span class="combo">${n}× 連線</span>
      <span class="mult">×${payouts[n]}</span>
    </div>`
  ).join('');
  return `
    <div class="paytable-card">
      <div class="paytable-symbol-icon">${sym.emoji}</div>
      <div class="paytable-symbol-info">
        <div class="paytable-symbol-name">${sym.name}</div>
        <div class="paytable-payouts">
          ${rows || '<div class="paytable-payout-row" style="font-size:10px;color:rgba(245,240,232,0.4);">特殊功能</div>'}
        </div>
      </div>
    </div>`;
}

function bindScreen11Events() {
  document.getElementById('paytable-close-btn')?.addEventListener('click', () => router.back());
  document.getElementById('btn-session-history')?.addEventListener('click', () => router.navigate('screen-12'));

  // Tab switching
  document.querySelectorAll('.paytable-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.paytable-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const name = tab.dataset.tab;
      ['settings', 'symbols', 'features'].forEach(t => {
        const el = document.getElementById(`paytable-tab-${t}`);
        if (el) el.style.display = t === name ? '' : 'none';
      });
    });
  });

  // BGM volume
  document.getElementById('bgm-vol')?.addEventListener('input', (e) => {
    const v = e.target.value / 100;
    if (window.audioEngine) window.audioEngine.setBGMVolume(v);
    const lbl = document.getElementById('bgm-vol-val');
    if (lbl) lbl.textContent = e.target.value + '%';
  });

  // SFX volume
  document.getElementById('sfx-vol')?.addEventListener('input', (e) => {
    const v = e.target.value / 100;
    if (window.audioEngine) window.audioEngine.setSFXVolume(v);
    const lbl = document.getElementById('sfx-vol-val');
    if (lbl) lbl.textContent = e.target.value + '%';
  });

  // Turbo toggle
  document.getElementById('turbo-toggle')?.addEventListener('change', (e) => {
    updateState({ turboMode: e.target.checked });
    const sel = document.getElementById('speed-select');
    if (sel) sel.value = e.target.checked ? 'turbo' : 'normal';
  });

  // Speed selector
  document.getElementById('speed-select')?.addEventListener('change', (e) => {
    const turbo = e.target.value === 'turbo' || e.target.value === 'fast';
    updateState({ turboMode: turbo });
    const chk = document.getElementById('turbo-toggle');
    if (chk) chk.checked = turbo;
  });
}

// ============================================================
// SCREEN 12 — SESSION HISTORY
// Table of last 10 spins, session stats, back button
// ============================================================
function renderScreen12() {
  const spins = [...SESSION_HISTORY, ...gameState.lastSpins].slice(0, 10);
  const stats = SESSION_STATS;

  const rows = spins.map(s => {
    const tierColor = s.tier === 'ultra' ? 'var(--color-gold-divine)'
                    : s.tier === 'mega'  ? '#FF6B35'
                    : s.tier === 'big'   ? 'var(--color-gold-bright)'
                    : s.tier === 'none'  ? 'rgba(245,240,232,0.3)'
                    : 'var(--color-arc-white)';
    return `
      <tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
        <td style="padding:8px 4px;font-size:10px;color:rgba(245,240,232,0.4);">${s.time || '—'}</td>
        <td style="padding:8px 4px;font-size:11px;color:var(--color-arc-white);">$${(s.bet||0).toFixed(2)}</td>
        <td style="padding:8px 4px;font-size:11px;color:${tierColor};font-weight:${s.win>0?700:400};">
          ${s.win > 0 ? '$' + s.win.toFixed(2) : '—'}
        </td>
        <td style="padding:8px 4px;font-size:10px;color:${tierColor};">${s.result || '—'}</td>
      </tr>`;
  }).join('');

  return `
    <div id="screen-12" class="screen hidden" style="background:rgba(10,15,30,0.97);display:flex;flex-direction:column;align-items:center;">
      <div style="width:100%;max-width:600px;padding:16px 20px 0;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <div style="font-family:Orbitron,sans-serif;font-size:16px;color:var(--color-gold-bright);font-weight:700;">
            📊 遊戲記錄
          </div>
          <button class="btn-dialog-cancel" id="btn-history-back"
                  style="padding:6px 14px;">← 返回</button>
        </div>

        <!-- Session summary -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;">
          ${[
            ['總旋轉', stats.totalSpins],
            ['總投注', '$' + (stats.totalBet || 0).toFixed(2)],
            ['總獲獎', '$' + (stats.totalWin || 0).toFixed(2)],
            ['最大單筆', '$' + (stats.biggestWin || 0).toFixed(2)],
            ['勝率', stats.winRate],
            ['時長', stats.sessionDuration],
          ].map(([label, val]) => `
            <div style="background:rgba(27,42,74,0.5);border:1px solid rgba(220,163,49,0.2);border-radius:8px;padding:10px;text-align:center;">
              <div style="font-size:9px;color:rgba(245,240,232,0.4);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">${label}</div>
              <div style="font-family:Orbitron,sans-serif;font-size:13px;color:var(--color-gold-bright);font-weight:700;">${val}</div>
            </div>`).join('')}
        </div>

        <!-- Spin table -->
        <div style="background:rgba(27,42,74,0.4);border:1px solid rgba(220,163,49,0.15);border-radius:10px;overflow:hidden;">
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:rgba(0,0,0,0.3);">
                <th style="padding:8px 4px;font-size:10px;color:rgba(245,240,232,0.4);text-transform:uppercase;letter-spacing:1px;text-align:left;font-weight:600;">時間</th>
                <th style="padding:8px 4px;font-size:10px;color:rgba(245,240,232,0.4);text-transform:uppercase;letter-spacing:1px;text-align:left;font-weight:600;">BET</th>
                <th style="padding:8px 4px;font-size:10px;color:rgba(245,240,232,0.4);text-transform:uppercase;letter-spacing:1px;text-align:left;font-weight:600;">WIN</th>
                <th style="padding:8px 4px;font-size:10px;color:rgba(245,240,232,0.4);text-transform:uppercase;letter-spacing:1px;text-align:left;font-weight:600;">結果</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>

        <div style="text-align:center;margin-top:12px;font-size:10px;color:rgba(245,240,232,0.25);">
          Session: ${gameState.sessionId} · 模擬資料 (Prototype Demo)
        </div>
      </div>
    </div>`;
}

function bindScreen12Events() {
  document.getElementById('btn-history-back')?.addEventListener('click', () => router.back());
}

// ============================================================
// SPIN SIMULATION
// ============================================================
function handleSpin() {
  const bet = totalBet();
  if (gameState.balance < bet) {
    showToast('⚠️ 餘額不足，請降低投注額');
    return;
  }
  updateState({
    balance:       gameState.balance - bet,
    currentWin:    0,
    sessionSpins:  gameState.sessionSpins + 1,
    cascadeStep:   0,
    lightningMarks: [],
  });
  if (window.audioEngine) window.audioEngine.playSFX('SFX-SPIN');
  router.navigate('screen-04', { forceRender: true });
}

/**
 * simulateSpin — async spin function.
 * 2-second delay, picks random result from SPIN_RESULTS,
 * then navigates through the cascade / thunder / FG flow.
 */
async function simulateSpin() {
  // Animate reels stopping
  for (let i = 0; i < 5; i++) {
    if (window.fxEngine) window.fxEngine.reelSpin(i);
  }
  const spinDuration = gameState.turboMode ? 900 : 2000;
  await new Promise(r => setTimeout(r, spinDuration));

  for (let i = 0; i < 5; i++) {
    await new Promise(r => setTimeout(r, 120));
    if (window.fxEngine) window.fxEngine.reelStop(i);
    if (window.audioEngine) window.audioEngine.playSFX('SFX-REEL-STOP');
  }

  resolveSpinResult();
}

function resolveSpinResult() {
  // Pick random result from the SPIN_RESULTS array
  const result = SPIN_RESULTS[Math.floor(Math.random() * SPIN_RESULTS.length)];
  const newGrid = result.grid || generateRandomGrid(5, gameState.rowCount);

  updateState({
    lastResult:         result,
    grid:               newGrid,
    lightningMarks:     result.lightningMarks || [],
    freeLetterProgress: Math.min(4,
      gameState.freeLetterProgress + (result.freeLetterDelta || 0)),
    currentWin: 0,
  });

  if (window.audioEngine) window.audioEngine.playReelStops(5);

  setTimeout(() => {
    if (result.cascades && result.cascades.length > 0) {
      // First apply base win from result
      updateState({ currentWin: result.baseWin || 0, balance: gameState.balance + (result.baseWin || 0) });
      updateState({ cascadeStep: 0 });
      router.navigate('screen-05', { forceRender: true });
    } else if (result.isThunderBlessing) {
      router.navigate('screen-06', { forceRender: true });
    } else if (gameState.freeLetterProgress >= 4) {
      updateState({ freeLetterProgress: 0, coinTossHeads: 0 });
      router.navigate('screen-07', { forceRender: true });
    } else if (result.totalWin >= totalBet() * 5) {
      updateState({ currentWin: result.totalWin, balance: gameState.balance + result.totalWin });
      showWinOverlay(result.totalWin);
    } else {
      updateState({ currentWin: result.totalWin || 0, balance: gameState.balance + (result.totalWin || 0) });
      router.navigate('screen-03', { forceRender: true });
    }
  }, 500);
}

// ============================================================
// BET CONTROLS (shared across game screens)
// ============================================================
function bindBetControls() {
  document.getElementById('btn-bet-down')?.addEventListener('click', () => {
    if (gameState.betIndex > 0) {
      updateState({ betIndex: gameState.betIndex - 1 });
      refreshHUDValues();
    }
  });
  document.getElementById('btn-bet-up')?.addEventListener('click', () => {
    const max = betLevels().length - 1;
    if (gameState.betIndex < max) {
      updateState({ betIndex: gameState.betIndex + 1 });
      refreshHUDValues();
    }
  });
  document.getElementById('btn-max-bet')?.addEventListener('click', () => {
    updateState({ betIndex: betLevels().length - 1 });
    refreshHUDValues();
  });
  document.getElementById('btn-turbo')?.addEventListener('click', () => {
    updateState({ turboMode: !gameState.turboMode });
    document.getElementById('btn-turbo')?.classList.toggle('active', gameState.turboMode);
  });
}

function refreshHUDValues() {
  const betEl = document.getElementById('hud-bet-val');
  if (betEl) betEl.textContent = currentBetStr();
  const totEl = document.getElementById('hud-totalbet-val');
  if (totEl) totEl.textContent = totalBetStr();
}

function bindGameHUDEvents() {
  bindBetControls();

  document.getElementById('btn-spin')?.addEventListener('click', () => {
    if (gameState.fgActive) handleFGSpin();
    else handleSpin();
  });

  document.getElementById('btn-paytable')?.addEventListener('click', () => router.navigate('screen-11'));
  document.getElementById('btn-settings')?.addEventListener('click', () => router.navigate('screen-11'));
  document.getElementById('btn-buy-feature')?.addEventListener('click', () => router.navigate('screen-10'));
}

// ============================================================
// FLOW MAP
// Modal showing all 12 screens in a grid, clickable
// ============================================================
const FLOW_MAP_SCREENS = [
  { id: 'screen-01', title: 'Loading',              desc: 'Zeus logo + progress bar → Lobby' },
  { id: 'screen-02', title: 'Lobby',                desc: 'BET / Currency / Extra Bet / START' },
  { id: 'screen-03', title: 'Main Game — Idle',     desc: '5×3 reels, SPIN, HUD' },
  { id: 'screen-04', title: 'Main Game — Spinning', desc: 'Reel animation, stops after 2s' },
  { id: 'screen-05', title: 'Cascade Animation',    desc: 'Symbol elimination + drop' },
  { id: 'screen-06', title: 'Thunder Blessing',     desc: 'SC trigger lightning overlay' },
  { id: 'screen-07', title: 'Coin Toss',            desc: '3-D coin, ×3→×77 multiplier path' },
  { id: 'screen-08', title: 'Free Game Active',     desc: '10 spins with multiplier' },
  { id: 'screen-09', title: 'Win Celebration',      desc: 'BIG/MEGA/ULTRA WIN overlay' },
  { id: 'screen-10', title: 'Buy Feature',          desc: '100× BET → Coin Toss' },
  { id: 'screen-11', title: 'Settings / Paytable',  desc: 'Volume, turbo, paytable tabs' },
  { id: 'screen-12', title: 'Session History',      desc: 'Last 10 spins table + stats' },
];

function showFlowMap() {
  const modal = document.getElementById('flow-map-modal');
  if (!modal) return;

  const isVisible = window.getComputedStyle(modal).display !== 'none';
  if (isVisible) {
    modal.classList.remove('open');
    modal.style.display = 'none';
    return;
  }

  // Build grid content
  const gridHtml = FLOW_MAP_SCREENS.map(s => `
    <div class="flow-map-card ${router && router.currentScreen === s.id ? 'active-screen' : ''}"
         data-target="${s.id}">
      <div class="flow-card-num">${s.id.replace('screen-', '')}</div>
      <div class="flow-card-title">${s.title}</div>
      <div class="flow-card-desc">${s.desc}</div>
    </div>`).join('');

  const screenGrid = document.getElementById('screen-grid');
  if (screenGrid) screenGrid.innerHTML = gridHtml;

  modal.style.display = 'flex';
  requestAnimationFrame(() => modal.classList.add('open'));

  // Wire card clicks
  modal.querySelectorAll('.flow-map-card').forEach(card => {
    card.addEventListener('click', () => {
      modal.classList.remove('open');
      modal.style.display = 'none';
      if (router) router.navigate(card.dataset.target, { forceRender: true });
    });
  });

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('open');
      modal.style.display = 'none';
    }
  }, { once: true });
}

// Expose for inline onclick in index.html
window.showFlowMap = showFlowMap;

// ============================================================
// ROUTER INIT
// ============================================================
let router;

function initPrototype() {
  router = new PrototypeRouter();

  const screenDefs = [
    ['screen-01', renderScreen01,  bindScreen01Events],
    ['screen-02', renderScreen02,  bindScreen02Events],
    ['screen-03', renderScreen03,  bindScreen03Events],
    ['screen-04', renderScreen04,  bindScreen04Events],
    ['screen-05', renderScreen05,  bindScreen05Events],
    ['screen-06', renderScreen06,  bindScreen06Events],
    ['screen-07', renderScreen07,  bindScreen07Events],
    ['screen-08', renderScreen08,  bindScreen08Events],
    ['screen-09', renderScreen09,  bindScreen09Events],
    ['screen-10', renderScreen10,  bindScreen10Events],
    ['screen-11', renderScreen11,  bindScreen11Events],
    ['screen-12', renderScreen12,  bindScreen12Events],
  ];

  screenDefs.forEach(([id, renderer, eventBinder]) => {
    router.register(id, renderer);
    router.screens[id + '_events'] = eventBinder;
  });

  router.init();

  window.router    = router;
  window.gameState = gameState;
  window.updateState = updateState;

  // Start at loading screen
  router.navigate('screen-01');

  console.log('[Prototype] Thunder Blessing v1.0.0-prototype initialized.');
  console.log('[Keys] 1-9: screens | M: flow map | Esc: back');
}

window.initPrototype = initPrototype;
