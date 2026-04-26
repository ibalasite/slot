/**
 * Thunder Blessing — Prototype Main Logic
 * Router + State + All 12 Screen Renderers + Game Flow Simulation
 */

'use strict';

// ============================================================
// CONSTANTS (shorthand refs to mock-data)
// ============================================================
const {
  GAME_CONFIG, SYMBOLS, REEL_POOL, SPIN_RESULTS, PLAYER_STATE, PAYTABLE,
  randomSymbol, generateRandomGrid, getBaseBet, getTotalBet,
  getBuyFeatureCost, formatAmount, classifyWin, getCoinTossProb,
} = window.MOCK_DATA;

// ============================================================
// GLOBAL GAME STATE (mutable, immutably updated via helpers)
// ============================================================
let gameState = {
  ...PLAYER_STATE,
  balance: 1000.00,
  currency: 'USD',
  betIndex: 7,
  extraBetActive: false,
  sessionWin: 0,
  sessionSpins: 0,
  freeLetterProgress: 0,
  lightningMarks: [],
  fgActive: false,
  fgSpinsRemaining: 0,
  fgMultiplierLevel: 0,
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
};

function updateState(partial) {
  gameState = { ...gameState, ...partial };
}

// ============================================================
// PROTO ROUTER
// ============================================================
class PrototypeRouter {
  constructor() {
    this.screens = {};
    this.history = [];
    this.currentScreen = null;
  }

  register(id, renderer) {
    this.screens[id] = renderer;
  }

  navigate(id, options = {}) {
    const renderer = this.screens[id];
    if (!renderer) { console.warn('[Router] Unknown screen:', id); return; }

    const container = document.getElementById('proto-content');
    if (!container) return;

    // Deactivate current
    if (this.currentScreen) {
      const prev = document.getElementById(this.currentScreen);
      if (prev) { prev.classList.remove('active'); prev.classList.add('hidden'); }
    }

    // Render if not already in DOM
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

    // Update history
    if (!options.replace && this.currentScreen !== id && this.currentScreen) {
      this.history.push(this.currentScreen);
    }
    this.currentScreen = id;

    // Update nav label
    const label = document.getElementById('nav-screen-label');
    if (label) label.textContent = SCREEN_LABELS[id] || id;

    const backBtn = document.getElementById('nav-back-btn');
    if (backBtn) backBtn.disabled = this.history.filter(Boolean).length === 0;

    // Bind events
    if (this.screens[id + '_events']) {
      this.screens[id + '_events']();
    }

    // Audio
    if (window.audioEngine) window.audioEngine.bindToScreen(id);

    // Scroll to top
    el.scrollTop = 0;
  }

  back() {
    const prev = this.history.pop();
    if (prev) this.navigate(prev, { replace: true });
  }

  init() {
    const backBtn = document.getElementById('nav-back-btn');
    if (backBtn) backBtn.addEventListener('click', () => this.back());
    const flowBtn = document.getElementById('nav-flow-btn');
    if (flowBtn) flowBtn.addEventListener('click', toggleFlowMap);
    const audioBtn = document.getElementById('audio-unlock-btn');
    if (audioBtn) {
      audioBtn.addEventListener('click', async () => {
        if (window.audioEngine) {
          const ok = await window.audioEngine.unlock();
          if (ok) {
            audioBtn.classList.add('hidden');
            window.audioEngine.playBGM('BGM_LOADING', { fadeIn: 0.5 });
          }
        }
      });
    }
  }
}

// ============================================================
// TOAST UTILITY (lightweight non-blocking notification)
// ============================================================
function showToast(message, durationMs = 2400) {
  let host = document.getElementById('proto-toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'proto-toast-host';
    host.style.cssText = 'position:fixed;top:24px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
    document.body.appendChild(host);
  }
  const toast = document.createElement('div');
  toast.className = 'proto-toast';
  toast.textContent = message;
  toast.style.cssText = 'padding:10px 18px;background:rgba(10,18,40,0.95);color:#FFD86B;border:1px solid rgba(255,216,107,0.4);border-radius:6px;font-size:14px;letter-spacing:0.5px;box-shadow:0 6px 24px rgba(0,0,0,0.4);opacity:0;transform:translateY(-8px);transition:opacity 200ms ease, transform 200ms ease;';
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

const SCREEN_LABELS = {
  'screen-01': '01 · LoadingScene',
  'screen-02': '02 · LobbyScene',
  'screen-03': '03 · GameScene IDLE',
  'screen-04': '04 · GameScene SPINNING',
  'screen-05': '05 · GameScene CASCADE',
  'screen-06': '06 · THUNDER BLESSING',
  'screen-07': '07 · Coin Toss',
  'screen-08': '08 · Free Game',
  'screen-09': '09 · Win Display',
  'screen-10': '10 · Buy Feature',
  'screen-11': '11 · Paytable',
  'screen-12': '12 · Reconnect',
};

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

function currentBetStr() {
  return fmt(baseBet());
}

function totalBetStr() {
  return fmt(totalBet());
}

// ============================================================
// REEL GRID RENDERER
// ============================================================
function renderGrid(grid, options = {}) {
  const rows = grid[0] ? grid[0].length : 3;
  const rowClass = rows >= 5 ? 'rows-6' : '';
  let html = `<div class="reel-container ${rowClass}" id="reel-container">`;
  for (let col = 0; col < grid.length; col++) {
    html += `<div class="reel-col" id="reel-col-${col}">`;
    for (let row = 0; row < grid[col].length; row++) {
      const symId = grid[col][row];
      const sym = SYMBOLS[symId] || SYMBOLS.GEM;
      const isWin = options.winPositions && options.winPositions.some(p => p[0] === col && p[1] === row);
      const isWild = sym.isWild;
      const isScatter = sym.isScatter;
      const hasLightning = gameState.lightningMarks.some(m => m[0] === col && m[1] === row);
      const cellClasses = [
        'symbol-cell',
        isWin ? 'win' : '',
        isWild ? 'is-wild' : '',
        isScatter ? 'is-scatter' : '',
      ].filter(Boolean).join(' ');

      html += `
        <div class="${cellClasses}" id="cell-${col}-${row}" data-col="${col}" data-row="${row}" data-sym="${symId}">
          <span class="symbol-emoji">${sym.emoji}</span>
          <span class="symbol-name">${sym.name}</span>
          ${hasLightning ? '<span class="lightning-mark">⚡</span>' : ''}
        </div>`;
    }
    html += `</div>`;
  }
  html += `</div>`;
  return html;
}

// ============================================================
// FREE LETTER BAR
// ============================================================
function renderFreeLetterBar(progress) {
  const letters = ['F', 'R', 'E', 'E'];
  return `
    <div class="free-letter-bar">
      <span class="free-letter-bar-label">FREE</span>
      ${letters.map((l, i) => `
        <div class="free-letter" data-lit="${i < progress ? 'true' : 'false'}">${l}</div>
      `).join('')}
      <span style="font-size:9px;color:rgba(245,240,232,0.4);margin-left:8px;letter-spacing:1px;">
        ${progress >= 4 ? '→ COIN TOSS' : `${progress}/4`}
      </span>
    </div>`;
}

// ============================================================
// FG MULTIPLIER BAR
// ============================================================
function renderFGMultBar(currentLevel, spinsLeft) {
  const mults = GAME_CONFIG.fgMultipliers;
  return `
    <div class="fg-mult-bar">
      <span class="fg-mult-bar-label">FG ×</span>
      <div class="fg-mult-nodes">
        ${mults.map((m, i) => {
          const reached = i < currentLevel;
          const current = i === currentLevel;
          const cls = reached ? 'reached' : (current ? 'current' : '');
          return `
            <div class="fg-mult-node">
              <div class="fg-mult-dot ${cls}">
                ${reached ? '✓' : (current ? '★' : '')}
              </div>
              <div class="fg-mult-val ${cls}">×${m}</div>
            </div>`;
        }).join('')}
      </div>
      <span class="fg-spins-remaining">${spinsLeft} spins</span>
    </div>`;
}

// ============================================================
// TOP BAR
// ============================================================
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
        ${gameState.fgActive ? '' : '<button class="topbar-icon-btn" id="btn-buy-feature" title="Buy Free Game">💰</button>'}
        <button class="topbar-icon-btn" id="btn-paytable" title="賠率表">📋</button>
        <button class="topbar-icon-btn" id="btn-settings" title="設定">⚙️</button>
      </div>
    </div>`;
}

// ============================================================
// BOTTOM HUD
// ============================================================
function renderHUD(options = {}) {
  const bet = currentBetStr();
  const isSpinning = options.spinning || false;
  const isFG = gameState.fgActive;
  const spinIcon = isSpinning ? '⏸' : (isFG ? '▶' : '▶');
  const spinLabel = isSpinning ? 'STOP' : (isFG ? 'FG SPIN' : 'SPIN');
  const extraBadge = gameState.extraBetActive
    ? `<span class="hud-extra-bet-badge">+EXTRA</span>` : '';

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
      <div class="loading-tip" id="loading-tip">
        正在載入遊戲資源，請稍候…
      </div>
    </div>`;
}

function bindScreen01Events() {
  const tips = [
    '集滿 FREE 字母觸發 Coin Toss，解鎖最高 ×77 倍率！',
    '雷神祝福：5個以上 SC 符號引爆全盤雷霆！',
    '連鎖消除讓每一次旋轉都充滿無限可能。',
    '最高中獎倍率：30,000×BET',
  ];
  const bar = document.getElementById('loading-bar');
  const pct = document.getElementById('loading-pct');
  const tip = document.getElementById('loading-tip');
  if (!bar) return;

  let progress = 0;
  let tipIdx = 0;
  const interval = setInterval(() => {
    progress += Math.random() * 18 + 8;
    if (progress >= 100) progress = 100;
    bar.style.width = progress + '%';
    if (pct) pct.textContent = Math.floor(progress) + '%';
    if (tip && progress > 30 && tipIdx < tips.length) {
      tip.textContent = tips[Math.floor(tipIdx)];
      tipIdx += 0.4;
    }
    if (progress >= 100) {
      clearInterval(interval);
      setTimeout(() => router.navigate('screen-02'), 600);
    }
  }, 180);
}

// ============================================================
// SCREEN 02 — LOBBY
// ============================================================
function renderScreen02() {
  const bet = currentBetStr();
  const bal = fmt(gameState.balance);
  const buyCost = fmt(getBuyFeatureCost(gameState));
  const levels = betLevels();
  const pipCount = Math.min(levels.length, 40);
  const pips = Array.from({ length: pipCount }, (_, i) =>
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
              <div class="balance-val">${bal}</div>
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
    // Refresh pip indicators
    const pips = document.querySelectorAll('.bet-pip');
    pips.forEach((p, i) => {
      p.classList.toggle('active', i === gameState.betIndex);
    });
  }
  document.getElementById('lobby-bet-down')?.addEventListener('click', () => {
    if (gameState.betIndex > 0) { updateState({ betIndex: gameState.betIndex - 1 }); refreshBet(); }
  });
  document.getElementById('lobby-bet-up')?.addEventListener('click', () => {
    const max = betLevels().length - 1;
    if (gameState.betIndex < max) { updateState({ betIndex: gameState.betIndex + 1 }); refreshBet(); }
  });
  document.getElementById('cur-usd')?.addEventListener('click', () => {
    updateState({ currency: 'USD', betIndex: Math.min(gameState.betIndex, GAME_CONFIG.betLevelsUSD.length - 1) });
    router.navigate('screen-02', { forceRender: true });
  });
  document.getElementById('cur-twd')?.addEventListener('click', () => {
    updateState({ currency: 'TWD', betIndex: Math.min(gameState.betIndex, GAME_CONFIG.betLevelsTWD.length - 1) });
    router.navigate('screen-02', { forceRender: true });
  });
  document.getElementById('extra-bet-toggle')?.addEventListener('change', (e) => {
    updateState({ extraBetActive: e.target.checked });
  });
  document.getElementById('lobby-start-btn')?.addEventListener('click', () => {
    if (window.audioEngine) window.audioEngine.playButtonClick();
    router.navigate('screen-03');
  });
  document.getElementById('lobby-buy-feature')?.addEventListener('click', () => {
    router.navigate('screen-10');
  });
}

// ============================================================
// SCREEN 03 — GAME IDLE
// ============================================================
function renderScreen03() {
  return `
    <div id="screen-03" class="screen game-scene hidden">
      ${renderTopBar()}
      <div class="game-area">
        ${renderFreeLetterBar(gameState.freeLetterProgress)}
        <div class="reel-frame" id="reel-frame">
          <div class="reel-frame-glow" id="reel-glow"></div>
          ${renderGrid(gameState.grid)}
          <div class="win-line-overlay" id="win-overlay"></div>
        </div>
      </div>
      ${renderHUD()}
    </div>`;
}

function bindScreen03Events() {
  bindGameHUDEvents('screen-03');
}

// ============================================================
// SCREEN 04 — SPINNING
// ============================================================
function renderScreen04() {
  // Show spinning state with blur effect via CSS class
  const spinGrid = generateRandomGrid(5, gameState.rowCount);
  return `
    <div id="screen-04" class="screen game-scene hidden">
      ${renderTopBar()}
      <div class="game-area">
        ${renderFreeLetterBar(gameState.freeLetterProgress)}
        <div class="reel-frame" id="reel-frame">
          <div class="reel-frame-glow active" id="reel-glow"></div>
          ${renderGrid(spinGrid)}
          <div style="position:absolute;top:8px;left:50%;transform:translateX(-50%);">
            <span class="state-badge cascade" style="background:rgba(255,215,0,0.15);color:var(--color-gold-bright);border-color:var(--color-gold-bright);">
              ⚡ SPINNING...
            </span>
          </div>
        </div>
      </div>
      ${renderHUD({ spinning: true })}
    </div>`;
}

function bindScreen04Events() {
  // Auto-stop after spin duration
  const delay = gameState.turboMode ? 800 : 1800;
  const cols = document.querySelectorAll('.reel-col');
  cols.forEach((col, i) => {
    setTimeout(() => col.classList.add('spinning'), i * 60);
  });

  setTimeout(() => {
    resolveSpinResult();
  }, delay);
}

// ============================================================
// SCREEN 05 — CASCADE
// ============================================================
function renderScreen05() {
  const result = gameState.lastResult || SPIN_RESULTS.cascade_3steps;
  const step = gameState.cascadeStep;
  const cascade = result.cascades && result.cascades[step];
  const winPos = cascade ? cascade.explodedPositions || [] : [];

  return `
    <div id="screen-05" class="screen game-scene hidden">
      ${renderTopBar()}
      <div class="game-area">
        ${renderFreeLetterBar(gameState.freeLetterProgress)}
        <div class="reel-frame" id="reel-frame" style="position:relative;">
          <div class="reel-frame-glow active" id="reel-glow"></div>
          ${renderGrid(gameState.grid, { winPositions: winPos })}
          <div class="cascade-counter" id="cascade-counter">
            ⚡ CASCADE ×${step + 1}  +${fmt(cascade ? cascade.stepWin || 0 : 0)}
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
  if (!result || !result.cascades) return;
  const step = gameState.cascadeStep;
  const cascade = result.cascades[step];
  if (!cascade) { finishCascades(); return; }

  // SFX
  if (window.audioEngine) window.audioEngine.playSFX('cascade', { freq: 440 + step * 60 });
  if (cascade.lightningMarks?.length && window.audioEngine) {
    window.audioEngine.playSFX('lightning');
  }

  const delay = gameState.turboMode ? 600 : 1200;
  setTimeout(() => {
    // Accumulate win
    const stepWin = cascade.stepWin || 0;
    updateState({
      currentWin: gameState.currentWin + stepWin,
      balance: gameState.balance + stepWin,
      cascadeStep: step + 1,
      freeLetterProgress: Math.min(4, gameState.freeLetterProgress + (cascade.freeLetterDelta || 0)),
    });

    const nextStep = gameState.cascadeStep;
    if (result.cascades[nextStep]) {
      router.navigate('screen-05', { forceRender: true });
    } else {
      finishCascades();
    }
  }, delay);
}

function finishCascades() {
  // Check if we need Thunder Blessing
  if (gameState.lastResult && gameState.lastResult.triggerThunderBlessing) {
    router.navigate('screen-06');
    return;
  }
  // Check if FREE letters are full → Coin Toss
  if (gameState.freeLetterProgress >= 4) {
    updateState({ freeLetterProgress: 0, coinTossHeads: 0 });
    setTimeout(() => router.navigate('screen-07'), 600);
    return;
  }
  // Check win amount for overlay
  if (gameState.currentWin >= totalBet() * 5) {
    showWinOverlay(gameState.currentWin);
    return;
  }
  // Back to idle
  setTimeout(() => {
    updateState({ cascadeStep: 0 });
    router.navigate('screen-03', { forceRender: true });
  }, 800);
}

// ============================================================
// SCREEN 06 — THUNDER BLESSING
// ============================================================
function renderScreen06() {
  const result = gameState.lastResult || SPIN_RESULTS.thunder_blessing;
  // Show all SC positions as "thunder" cells
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
            <div class="thunder-blessing-title">⚡ THUNDER BLESSING ⚡</div>
            <div class="thunder-blessing-sub">雷霆祝福 · SC 引爆</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
          <span class="state-badge thunder">⚡ THUNDER BLESSING</span>
          <span style="font-size:12px;color:var(--color-gold-divine);font-family:Orbitron,sans-serif;">
            ${result.thunderBlessingWin ? `WIN: ${fmt(result.thunderBlessingWin)}` : ''}
          </span>
        </div>
      </div>
      ${renderHUD({ spinning: true })}
    </div>`;
}

function bindScreen06Events() {
  if (window.audioEngine) window.audioEngine.playThunderBlessingSequence();
  if (window.fxEngine) {
    const cells = document.querySelectorAll('.symbol-cell.is-scatter');
    window.fxEngine.thunderBlessingBurst(Array.from(cells), Array.from(cells));
  }

  const delay = gameState.turboMode ? 1200 : 2800;
  setTimeout(() => {
    const result = gameState.lastResult;
    const bonus = result && result.thunderBlessingWin ? result.thunderBlessingWin : 50;
    updateState({
      currentWin: gameState.currentWin + bonus,
      balance: gameState.balance + bonus,
      freeLetterProgress: Math.min(4, gameState.freeLetterProgress + 2),
    });
    // Check FREE letters
    if (gameState.freeLetterProgress >= 4) {
      updateState({ freeLetterProgress: 0, coinTossHeads: 0 });
      router.navigate('screen-07');
    } else if (gameState.currentWin >= totalBet() * 5) {
      showWinOverlay(gameState.currentWin);
    } else {
      updateState({ cascadeStep: 0 });
      router.navigate('screen-03', { forceRender: true });
    }
  }, delay);
}

// ============================================================
// SCREEN 07 — COIN TOSS
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
    const cls = i < heads ? 'unlocked' : (i === heads ? 'current' : '');
    return `
      <div class="coin-toss-mult-item ${cls}">
        <div class="mult-val">×${m}</div>
        <div class="mult-heads">${probs[i] ? Math.round(probs[i] * 100) + '%' : '—'}</div>
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
            heads >= 5 ? '🎉 恭喜！達成最高倍率 ×77！' :
            `已連續 ${heads} 次 HEADS！下次 HEADS 機率：${Math.round((probs[heads] || 0) * 100)}%`}
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

        <div id="coin-result-display" style="min-height:44px;display:flex;align-items:center;justify-content:center;">
          ${heads > 0 ? `<div class="coin-result-text heads">HEADS ×${heads}</div>` : ''}
        </div>

        <div class="coin-toss-progress">
          <div class="coin-toss-progress-title">HEADS 進度 (5次 = ×77)</div>
          <div class="coin-toss-heads-track">${headsTrack}</div>
        </div>

        <div class="coin-toss-mult-row">${multRow}</div>

        <div style="text-align:center;font-size:11px;color:rgba(245,240,232,0.5);">
          ${heads === 0 ? `當前倍率：— &nbsp;→&nbsp; 下一倍率：<b style="color:var(--color-fg-blue)">×${nextMult}</b>` :
            heads >= 5 ? `🏆 最高倍率達成 <b style="color:var(--color-gold-bright)">×77</b>` :
            `當前倍率：<b style="color:var(--color-fg-blue)">×${currentMult}</b> &nbsp;→&nbsp; 下一倍率：<b style="color:var(--color-gold-bright)">×${nextMult}</b>`}
        </div>

        <button class="btn-toss" id="btn-toss" ${heads >= 5 ? 'disabled' : ''}>
          ${heads >= 5 ? '🎉 進入自由遊戲 ×77' : `翻轉硬幣 (HEADS 機率 ${probs[heads] ? Math.round(probs[heads] * 100) : 0}%)`}
        </button>
        ${heads >= 5 ? `
          <button class="btn-toss" id="btn-enter-fg"
                  style="background:var(--color-fg-blue);margin-top:-4px;">
            ▶ 進入自由遊戲
          </button>` : ''}
      </div>
    </div>`;
}

function bindScreen07Events() {
  document.getElementById('btn-toss')?.addEventListener('click', () => {
    handleCoinToss();
  });
  document.getElementById('btn-enter-fg')?.addEventListener('click', () => {
    enterFreeGame();
  });
}

function handleCoinToss() {
  const heads = gameState.coinTossHeads;
  const prob  = GAME_CONFIG.coinProbs[heads] ?? 0;
  const result = Math.random() < prob ? 'HEADS' : 'TAILS';

  const coin = document.getElementById('toss-coin');
  const btn  = document.getElementById('btn-toss');
  if (btn) btn.disabled = true;

  if (window.audioEngine) window.audioEngine.playCoinTossFlip();
  if (window.fxEngine) {
    window.fxEngine.coinFlip(coin, result, () => {
      processCoinResult(result);
    });
  } else {
    setTimeout(() => processCoinResult(result), 1300);
  }
}

function processCoinResult(result) {
  if (window.audioEngine) window.audioEngine.playCoinResult(result === 'HEADS');

  if (result === 'HEADS') {
    const newHeads = gameState.coinTossHeads + 1;
    const newLevel = newHeads - 1;
    updateState({
      coinTossHeads: newHeads,
      fgMultiplierLevel: Math.min(newLevel, GAME_CONFIG.fgMultipliers.length - 1),
    });

    if (newHeads >= 5) {
      // Max multiplier reached
      setTimeout(() => router.navigate('screen-07', { forceRender: true }), 400);
      return;
    }

    if (window.audioEngine) window.audioEngine.playLetterLight(newLevel);
    setTimeout(() => router.navigate('screen-07', { forceRender: true }), 600);
  } else {
    // TAILS — enter FG with current multiplier
    const level = Math.max(0, gameState.coinTossHeads - 1);
    updateState({ fgMultiplierLevel: Math.max(0, level) });
    const resultDisplay = document.getElementById('coin-result-display');
    if (resultDisplay) {
      resultDisplay.innerHTML = '<div class="coin-result-text tails">TAILS</div>';
    }
    setTimeout(() => enterFreeGame(), 1200);
  }
}

function enterFreeGame() {
  if (window.audioEngine) window.audioEngine.playFGEnterSequence();
  updateState({
    fgActive: true,
    fgSpinsRemaining: 10,
    fgTotalWin: 0,
    currentWin: 0,
    coinTossHeads: 0,
  });
  setTimeout(() => router.navigate('screen-08'), 800);
}

// ============================================================
// SCREEN 08 — FREE GAME
// ============================================================
function renderScreen08() {
  const multLevel = gameState.fgMultiplierLevel;
  const mult = GAME_CONFIG.fgMultipliers[multLevel] || 3;
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
          <div class="reel-frame-glow" style="box-shadow:0 0 20px rgba(0,191,255,0.5)"></div>
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
  if (window.audioEngine) {
    const multLevel = gameState.fgMultiplierLevel;
    const bgm = multLevel >= 4 ? 'BGM_77X' : 'BGM_FREE_GAME';
    window.audioEngine.playBGM(bgm, { force: true });
  }

  const spinBtn = document.getElementById('btn-spin');
  if (spinBtn) {
    spinBtn.addEventListener('click', () => handleFGSpin());
  }
  bindBetControls();

  document.getElementById('btn-paytable')?.addEventListener('click', () => router.navigate('screen-11'));
  document.getElementById('btn-settings')?.addEventListener('click', () => showToast('⚙️ 設定功能即將推出'));
}

function handleFGSpin() {
  if (gameState.fgSpinsRemaining <= 0) {
    endFreeGame();
    return;
  }

  updateState({ fgSpinsRemaining: gameState.fgSpinsRemaining - 1 });
  const bet = totalBet();
  const baseWin = bet * (Math.random() * 8 + 1);
  const mult = GAME_CONFIG.fgMultipliers[gameState.fgMultiplierLevel] || 3;
  const spinWin = baseWin * mult;
  const newGrid = generateRandomGrid(5, gameState.rowCount);

  updateState({
    grid: newGrid,
    currentWin: spinWin,
    balance: gameState.balance + spinWin,
    fgTotalWin: gameState.fgTotalWin + spinWin,
    sessionWin: gameState.sessionWin + spinWin,
  });

  if (window.audioEngine) window.audioEngine.playSFX('win_small');
  router.navigate('screen-08', { forceRender: true });

  if (gameState.fgSpinsRemaining <= 0) {
    setTimeout(() => endFreeGame(), 1200);
  }
}

function endFreeGame() {
  const totalFGWin = gameState.fgTotalWin;
  updateState({ fgActive: false, fgMultiplierLevel: 0, fgTotalWin: 0, fgSpinsRemaining: 0 });

  if (totalFGWin >= totalBet() * 15) {
    showWinOverlay(totalFGWin, 'mega-win');
  } else if (totalFGWin >= totalBet() * 5) {
    showWinOverlay(totalFGWin, 'big-win');
  } else {
    router.navigate('screen-03', { forceRender: true });
  }
}

// ============================================================
// SCREEN 09 — WIN DISPLAY OVERLAY
// ============================================================
function renderScreen09() {
  const tier = gameState._winTier || 'big-win';
  const amount = gameState.currentWin || 0;
  const tierData = Object.values(GAME_CONFIG.winTiers).find(t => t.tier === tier)
    || GAME_CONFIG.winTiers.big;

  const starsHtml = '⭐'.repeat(
    tier === 'max-win' ? 5 : tier === 'jackpot-win' ? 4 : tier === 'mega-win' ? 3 : 2
  );

  return `
    <div id="screen-09" class="screen hidden">
      <div class="win-starburst"></div>
      <div class="win-overlay-container">
        <div class="win-tier-banner ${tier}">${tierData.label}</div>
        <div class="win-stars-row">${starsHtml}</div>
        <div class="win-amount-display" id="win-counter-display">${fmt(amount)}</div>
        <div class="win-subtitle">TOTAL WIN · 恭喜中獎</div>
        <button class="btn-collect" id="btn-collect-win">COLLECT 領取</button>
      </div>
    </div>`;
}

function bindScreen09Events() {
  if (window.audioEngine) {
    const tier = gameState._winTier || 'big-win';
    window.audioEngine.playWinSound(tier);
    window.audioEngine.bindToScreen('screen-09');
  }

  // Animate counter
  const counterEl = document.getElementById('win-counter-display');
  if (counterEl && window.fxEngine) {
    const amount = gameState.currentWin || 0;
    const sym = gameState.currency === 'USD' ? '$' : 'NT$';
    const decimals = gameState.currency === 'USD' ? 2 : 0;
    window.fxEngine.animateCounter(
      counterEl, 0, amount, 1800,
      v => `${sym}${decimals === 0 ? Math.round(v).toLocaleString() : v.toFixed(decimals)}`
    );
  }

  // Coin rain
  if (window.fxEngine) {
    window.fxEngine.goldCoinRain(window.innerWidth / 2, 0, 60);
  }

  document.getElementById('btn-collect-win')?.addEventListener('click', () => {
    if (gameState.fgActive) {
      router.navigate('screen-08', { forceRender: true });
    } else {
      updateState({ currentWin: 0, cascadeStep: 0 });
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
// SCREEN 10 — BUY FEATURE DIALOG
// ============================================================
function renderScreen10() {
  const buyCost100 = fmt(getBuyFeatureCost(gameState));
  const buyCost50  = fmt(getBuyFeatureCost(gameState) * 0.5);

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
              <div class="buy-option-name">⚡ 標準購買</div>
              <div class="buy-option-desc">100× BET · 保證5次 Coin Toss，有機會達成 ×77</div>
            </div>
            <div class="buy-option-price">${buyCost100}</div>
          </div>
          <div class="buy-option-card" id="buy-opt-50" data-opt="50">
            <div>
              <div class="buy-option-name">🌙 折扣購買</div>
              <div class="buy-option-desc">50× BET · 保證3次 Coin Toss，最高倍率 ×17</div>
            </div>
            <div class="buy-option-price">${buyCost50}</div>
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

  document.getElementById('btn-buy-cancel')?.addEventListener('click', () => {
    router.back();
  });

  document.getElementById('btn-buy-confirm')?.addEventListener('click', () => {
    const cost = baseBet() * selectedOpt;
    if (gameState.balance < cost) {
      alert('餘額不足');
      return;
    }
    if (window.audioEngine) window.audioEngine.playSFX('buy_feature');
    updateState({
      balance: gameState.balance - cost,
      coinTossHeads: 0,
      fgMultiplierLevel: 0,
    });
    // Buy Feature → guaranteed Coin Toss with boosted heads
    if (selectedOpt === 100) {
      updateState({ coinTossHeads: 0 });  // Full 5-toss sequence
    } else {
      updateState({ coinTossHeads: 2 });  // Start at 2 heads already
    }
    router.navigate('screen-07', { forceRender: true });
  });
}

// ============================================================
// SCREEN 11 — PAYTABLE
// ============================================================
function renderScreen11() {
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
        <div class="paytable-title">📋 賠率表 Paytable</div>
        <div style="font-size:10px;color:rgba(245,240,232,0.4);margin-top:4px;">
          基於單次投注額計算 · 57條連線 · Cascade消除
        </div>
      </div>
      <button class="paytable-close-btn" id="paytable-close-btn">✕</button>
      <div class="paytable-tabs">
        <div class="paytable-tab active" data-tab="symbols">符號賠率</div>
        <div class="paytable-tab" data-tab="features">遊戲功能</div>
        <div class="paytable-tab" data-tab="rules">規則說明</div>
      </div>
      <div class="paytable-body scrollable" id="paytable-body">
        <div id="paytable-tab-symbols">
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
                <div class="paytable-payouts"><div class="paytable-payout-row"><span class="combo">替換所有普通符號</span></div></div>
              </div>
            </div>
            <div class="paytable-card">
              <div class="paytable-symbol-icon">⚙️</div>
              <div class="paytable-symbol-info">
                <div class="paytable-symbol-name">Scatter SC</div>
                <div class="paytable-payouts"><div class="paytable-payout-row"><span class="combo">×5+ 觸發雷霆祝福</span></div></div>
              </div>
            </div>
          </div>
        </div>
        <div id="paytable-tab-features" style="display:none;">${features}</div>
        <div id="paytable-tab-rules" style="display:none;">
          <div class="feature-card">
            <div class="feature-card-title">🎰 基本規則</div>
            <div class="feature-card-desc">5×3 滾輪，57條固定連線。從最左側滾輪開始，向右連續3個以上相同符號即獲勝。</div>
            <ul class="feature-card-list">
              <li>所有獲勝按投注額倍率計算</li>
              <li>Wild 符號替換除 SC 外的所有符號</li>
              <li>Cascade 消除：獲勝符號消除，上方符號落下填補，持續至無新獲勝為止</li>
              <li>最高單次獲勝上限：30,000× BET</li>
              <li>RTP：96.5%</li>
            </ul>
          </div>
          <div class="feature-card">
            <div class="feature-card-title">💰 FG 倍率序列</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
              ${GAME_CONFIG.fgMultipliers.map((m, i) => `
                <div style="background:rgba(0,191,255,0.1);border:1px solid rgba(0,191,255,0.3);
                            border-radius:8px;padding:8px 12px;text-align:center;">
                  <div style="font-family:Orbitron,sans-serif;font-size:16px;color:var(--color-fg-blue);">×${m}</div>
                  <div style="font-size:9px;color:rgba(245,240,232,0.4);">第${i + 1}次 HEADS</div>
                  <div style="font-size:9px;color:rgba(255,215,0,0.7);">機率 ${Math.round(GAME_CONFIG.coinProbs[i] * 100)}%</div>
                </div>`).join('')}
            </div>
          </div>
        </div>
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
        <div class="paytable-payouts">${rows || '<div class="paytable-payout-row" style="font-size:10px;color:rgba(245,240,232,0.4);">特殊功能</div>'}</div>
      </div>
    </div>`;
}

function bindScreen11Events() {
  document.getElementById('paytable-close-btn')?.addEventListener('click', () => router.back());

  document.querySelectorAll('.paytable-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.paytable-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const name = tab.dataset.tab;
      ['symbols', 'features', 'rules'].forEach(t => {
        const el = document.getElementById(`paytable-tab-${t}`);
        if (el) el.style.display = t === name ? '' : 'none';
      });
    });
  });
}

// ============================================================
// SCREEN 12 — RECONNECT
// ============================================================
function renderScreen12() {
  return `
    <div id="screen-12" class="screen hidden">
      <div class="reconnect-dialog">
        <div class="reconnect-icon">🔄</div>
        <div class="reconnect-title">連線中斷</div>
        <div class="reconnect-subtitle" style="font-family:Orbitron,sans-serif;font-size:13px;color:rgba(245,240,232,0.5);">
          Connection Lost
        </div>
        <div class="reconnect-desc">
          正在嘗試重新連線至遊戲伺服器，<br>請稍候或手動重試。
        </div>
        <div class="reconnect-progress-track">
          <div class="reconnect-progress-fill"></div>
        </div>
        <button class="btn-reconnect" id="btn-reconnect">重新連線 Reconnect</button>
        <div class="reconnect-server-info">
          SERVER: game-srv-01.thunder-blessing.dev<br>
          SESSION: TB-${Date.now().toString(36).toUpperCase()}<br>
          BALANCE SAVED · 遊戲進度已保留
        </div>
        <button class="btn-dialog-cancel" style="width:100%;margin-top:4px;" id="btn-reconnect-lobby">
          返回大廳
        </button>
      </div>
    </div>`;
}

function bindScreen12Events() {
  document.getElementById('btn-reconnect')?.addEventListener('click', () => {
    if (window.audioEngine) window.audioEngine.playSFX('reconnect');
    setTimeout(() => router.navigate('screen-03', { forceRender: true }), 1000);
  });
  document.getElementById('btn-reconnect-lobby')?.addEventListener('click', () => {
    router.navigate('screen-02', { forceRender: true });
  });
}

// ============================================================
// GAME FLOW — SPIN HANDLING
// ============================================================
function handleSpin() {
  const bet = totalBet();
  if (gameState.balance < bet) { alert('餘額不足，請降低投注額。'); return; }

  updateState({
    balance: gameState.balance - bet,
    currentWin: 0,
    sessionSpins: gameState.sessionSpins + 1,
    cascadeStep: 0,
    lightningMarks: [],
  });

  if (window.audioEngine) window.audioEngine.playSFX('spin_start');

  // Navigate to SPINNING screen
  router.navigate('screen-04', { forceRender: true });
}

function resolveSpinResult() {
  // Pick a random sample result for prototype demonstration
  const resultKeys = Object.keys(SPIN_RESULTS);
  const key = resultKeys[Math.floor(Math.random() * resultKeys.length)];
  const result = SPIN_RESULTS[key];

  const newGrid = result.grid || generateRandomGrid(5, gameState.rowCount);
  updateState({
    lastResult: result,
    grid: newGrid,
    lightningMarks: result.lightningMarks || [],
    freeLetterProgress: Math.min(4,
      gameState.freeLetterProgress + (result.freeLetterDelta || 0)),
    currentWin: result.wins ? result.wins.reduce((a, w) => a + (w.winAmount || 0), 0) : 0,
  });

  if (window.audioEngine) window.audioEngine.playSpinSequence(5);

  setTimeout(() => {
    if (result.cascades && result.cascades.length > 0) {
      updateState({ cascadeStep: 0 });
      router.navigate('screen-05', { forceRender: true });
    } else if (result.triggerThunderBlessing) {
      router.navigate('screen-06', { forceRender: true });
    } else if (result.freeLetterDelta && gameState.freeLetterProgress >= 4) {
      updateState({ freeLetterProgress: 0, coinTossHeads: 0 });
      router.navigate('screen-07', { forceRender: true });
    } else if (gameState.currentWin >= totalBet() * 5) {
      showWinOverlay(gameState.currentWin);
    } else {
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
    const btn = document.getElementById('btn-turbo');
    if (btn) btn.classList.toggle('active', gameState.turboMode);
  });
}

function refreshHUDValues() {
  const betEl = document.getElementById('hud-bet-val');
  if (betEl) betEl.textContent = currentBetStr();
  const totalEl = document.getElementById('hud-totalbet-val');
  if (totalEl) totalEl.textContent = totalBetStr();
}

function bindGameHUDEvents(screenId) {
  bindBetControls();

  document.getElementById('btn-spin')?.addEventListener('click', () => {
    if (gameState.fgActive) {
      handleFGSpin();
    } else {
      handleSpin();
    }
  });

  document.getElementById('btn-paytable')?.addEventListener('click', () => {
    router.navigate('screen-11');
  });

  document.getElementById('btn-buy-feature')?.addEventListener('click', () => {
    router.navigate('screen-10');
  });

  document.getElementById('btn-settings')?.addEventListener('click', () => {
    showToast('⚙️ 設定功能即將推出');
  });
}

// ============================================================
// FLOW MAP
// ============================================================
const FLOW_MAP_SCREENS = [
  { id: 'screen-01', title: 'LoadingScene',        desc: 'Zeus logo + 進度條，自動跳轉' },
  { id: 'screen-02', title: 'LobbyScene',           desc: 'BET選擇/幣種/START' },
  { id: 'screen-03', title: 'GameScene IDLE',       desc: '主遊戲5×3滾輪，SPIN按鈕' },
  { id: 'screen-04', title: 'GameScene SPINNING',   desc: '旋轉動畫效果' },
  { id: 'screen-05', title: 'GameScene CASCADE',    desc: '連鎖消除符號落下' },
  { id: 'screen-06', title: 'THUNDER BLESSING',     desc: 'SC引爆雷霆祝福特效' },
  { id: 'screen-07', title: 'Coin Toss',            desc: '硬幣翻轉倍率進度' },
  { id: 'screen-08', title: 'Free Game',            desc: '自由遊戲含倍率顯示' },
  { id: 'screen-09', title: 'Win Display',          desc: 'BIG WIN/MEGA WIN計數器' },
  { id: 'screen-10', title: 'Buy Feature',          desc: '購買自由遊戲確認框' },
  { id: 'screen-11', title: 'Paytable',             desc: '賠率表完整說明' },
  { id: 'screen-12', title: 'Reconnect',            desc: '重連畫面' },
];

function toggleFlowMap() {
  const modal = document.getElementById('flow-map-modal');
  if (!modal) return;
  const isOpen = modal.classList.contains('open');
  if (isOpen) {
    modal.classList.remove('open');
  } else {
    renderFlowMapContent();
    modal.classList.add('open');
  }
}

function renderFlowMapContent() {
  const modal = document.getElementById('flow-map-modal');
  if (!modal) return;
  const grid = FLOW_MAP_SCREENS.map(s => `
    <div class="flow-map-card ${router.currentScreen === s.id ? 'active-screen' : ''}"
         data-target="${s.id}">
      <div class="flow-card-num">${s.id.replace('screen-', '').padStart(2, '0')}</div>
      <div class="flow-card-title">${s.title}</div>
      <div class="flow-card-desc">${s.desc}</div>
    </div>`).join('');

  modal.innerHTML = `
    <span class="flow-map-close" id="flow-map-close">✕</span>
    <div class="flow-map-title">⚡ 畫面流程地圖</div>
    <div class="flow-map-grid">${grid}</div>
    <div style="margin-top:12px;font-size:10px;color:rgba(245,240,232,0.3);text-align:center;">
      點擊任意畫面直接跳轉 · 當前：${SCREEN_LABELS[router.currentScreen] || '—'}
    </div>`;

  modal.querySelectorAll('.flow-map-card').forEach(card => {
    card.addEventListener('click', () => {
      const target = card.dataset.target;
      modal.classList.remove('open');
      router.navigate(target, { forceRender: true });
    });
  });

  document.getElementById('flow-map-close')?.addEventListener('click', () => {
    modal.classList.remove('open');
  });
}

// ============================================================
// ROUTER INSTANCE + REGISTRATION
// ============================================================
let router;

function initPrototype() {
  router = new PrototypeRouter();

  // Register all screens with their renderers and event binders
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

  screenDefs.forEach(([id, renderer, events]) => {
    router.register(id, renderer);
    router.screens[id + '_events'] = events;
  });

  router.init();

  // Expose globals
  window.router   = router;
  window.gameState = gameState; // for debugging

  // Start at loading screen
  router.navigate('screen-01');

  console.log('[Prototype] Initialized — Thunder Blessing v1.0.0');
}

// ============================================================
// EXPORT
// ============================================================
window.initPrototype = initPrototype;
