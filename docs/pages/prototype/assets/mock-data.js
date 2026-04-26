/**
 * Thunder Blessing — Mock Data Module
 * All game configuration, symbol definitions, and spin result samples.
 */

// ============================================================
// GAME CONFIG
// ============================================================
const GAME_CONFIG = {
  title: '雷神賜福 Thunder Blessing',
  version: '1.0.0-prototype',
  reels: 5,
  rows: { min: 3, max: 6 },
  lines: 57,
  rtp: 96.5,

  // USD bet levels (40 levels)
  betLevelsUSD: [
    0.25, 0.50, 0.75, 1.00, 1.25, 1.50, 1.75, 2.00,
    2.25, 2.50, 2.75, 3.00, 3.25, 3.50, 3.75, 4.00,
    4.25, 4.50, 4.75, 5.00, 5.25, 5.50, 5.75, 6.00,
    6.25, 6.50, 6.75, 7.00, 7.25, 7.50, 7.75, 8.00,
    8.25, 8.50, 8.75, 9.00, 9.25, 9.50, 9.75, 10.00,
  ],

  // TWD bet levels (32 levels, approx ×32 conversion)
  betLevelsTWD: [
    8, 16, 24, 32, 40, 50, 60, 80,
    100, 120, 150, 180, 200, 240, 280, 320,
    360, 400, 450, 500, 550, 600, 650, 700,
    750, 800, 850, 900, 950, 1000, 1200, 1600,
  ],

  defaultBetIndexUSD: 7,    // $2.00
  defaultBetIndexTWD: 9,    // NT$120
  extraBetMultiplier: 3,    // Extra Bet costs 3× BET
  buyFeatureMultiplier: 100, // Buy Feature costs 100× BET

  // Free Game multiplier sequence
  fgMultipliers: [3, 7, 17, 27, 77],

  // Coin Toss HEADS probability per stage
  coinProbs: [0.80, 0.68, 0.56, 0.48, 0.40],
  coinTossesNeeded: 5, // 5 HEADS to reach max ×77

  // Win tiers (in terms of total_bet multiplier)
  winTiers: {
    normal:   { min: 0,      max: 4.99,    label: 'WIN',     tier: 'normal' },
    big:      { min: 5,      max: 14.99,   label: 'BIG WIN', tier: 'big-win' },
    mega:     { min: 15,     max: 49.99,   label: 'MEGA WIN', tier: 'mega-win' },
    jackpot:  { min: 50,     max: 999.99,  label: 'JACKPOT WIN', tier: 'jackpot-win' },
    maxwin:   { min: 1000,   max: 30000,   label: 'MAX WIN ×30,000', tier: 'max-win' },
  },

  maxWinMultiplier: 30000,
  currency: { USD: '$', TWD: 'NT$' },
};

// ============================================================
// SYMBOLS
// ============================================================
const SYMBOLS = {
  WILD: {
    id: 'WILD',
    emoji: '⚡',
    name: 'Wild',
    color: '#FFE55C',
    isWild: true,
    isScatter: false,
    payouts: {}, // Substitutes for all except Scatter
    description: '替換除 SC 外的所有符號',
  },
  SCATTER: {
    id: 'SCATTER',
    emoji: '⚙️',
    name: 'Thunder SC',
    color: '#FF8C00',
    isWild: false,
    isScatter: true,
    payouts: {}, // Triggers Thunder Blessing
    description: '引爆雷霆祝福特效',
  },
  ZEUS: {
    id: 'ZEUS',
    emoji: '🏛️',
    name: 'Zeus',
    color: '#DCA331',
    isWild: false,
    isScatter: false,
    payouts: { 3: 2.5, 4: 8, 5: 25 },
    description: '最高價值符號',
  },
  EAGLE: {
    id: 'EAGLE',
    emoji: '🦅',
    name: '神鷹',
    color: '#C8A000',
    isWild: false,
    isScatter: false,
    payouts: { 3: 1.5, 4: 5, 5: 15 },
  },
  TRIDENT: {
    id: 'TRIDENT',
    emoji: '🔱',
    name: '三叉戟',
    color: '#00BFFF',
    isWild: false,
    isScatter: false,
    payouts: { 3: 1.2, 4: 4, 5: 12 },
  },
  HELMET: {
    id: 'HELMET',
    emoji: '⛑️',
    name: '戰盔',
    color: '#C0C0C0',
    isWild: false,
    isScatter: false,
    payouts: { 3: 0.8, 4: 2.5, 5: 8 },
  },
  HARP: {
    id: 'HARP',
    emoji: '🎵',
    name: '豎琴',
    color: '#B8860B',
    isWild: false,
    isScatter: false,
    payouts: { 3: 0.6, 4: 2, 5: 6 },
  },
  LAUREL: {
    id: 'LAUREL',
    emoji: '🌿',
    name: '月桂冠',
    color: '#2E8B57',
    isWild: false,
    isScatter: false,
    payouts: { 3: 0.4, 4: 1.5, 5: 4 },
  },
  COIN: {
    id: 'COIN',
    emoji: '🪙',
    name: '金幣',
    color: '#FFD700',
    isWild: false,
    isScatter: false,
    payouts: { 3: 0.3, 4: 1, 5: 3 },
  },
  GEM: {
    id: 'GEM',
    emoji: '💎',
    name: '寶石',
    color: '#4169E1',
    isWild: false,
    isScatter: false,
    payouts: { 3: 0.2, 4: 0.8, 5: 2.5 },
  },
  LIGHTNING_MARK: {
    id: 'LIGHTNING_MARK',
    emoji: '🌩️',
    name: '雷印記',
    color: '#FFE55C',
    isWild: false,
    isScatter: false,
    isLightningMark: true,
    payouts: {},
    description: '集滿5個FREE字母觸發 Coin Toss',
  },
};

const SYMBOL_KEYS = Object.keys(SYMBOLS);

// Helper: get symbol array
function getSymbolList() {
  return Object.values(SYMBOLS);
}

// Weighted random symbol for display (not scatter/wild in reels normally)
const REEL_POOL = [
  'ZEUS','ZEUS',
  'EAGLE','EAGLE','EAGLE',
  'TRIDENT','TRIDENT','TRIDENT',
  'HELMET','HELMET','HELMET','HELMET',
  'HARP','HARP','HARP','HARP',
  'LAUREL','LAUREL','LAUREL','LAUREL','LAUREL',
  'COIN','COIN','COIN','COIN','COIN','COIN',
  'GEM','GEM','GEM','GEM','GEM','GEM','GEM',
  'WILD',
  'SCATTER',
];

function randomSymbol() {
  return REEL_POOL[Math.floor(Math.random() * REEL_POOL.length)];
}

function generateRandomGrid(cols = 5, rows = 3) {
  const grid = [];
  for (let c = 0; c < cols; c++) {
    const col = [];
    for (let r = 0; r < rows; r++) {
      col.push(randomSymbol());
    }
    grid.push(col);
  }
  return grid;
}

// ============================================================
// SPIN RESULT SAMPLES
// ============================================================

const SPIN_RESULTS = {

  // 1. Normal Win — simple 3-of-a-kind on reel 1-3
  normal_win: {
    id: 'normal_win',
    label: '普通中獎',
    grid: [
      ['ZEUS',    'HARP',   'COIN'],
      ['ZEUS',    'LAUREL', 'GEM'],
      ['ZEUS',    'EAGLE',  'HELMET'],
      ['TRIDENT', 'COIN',   'LAUREL'],
      ['GEM',     'HELMET', 'HARP'],
    ],
    wins: [
      { symbolId: 'ZEUS', count: 3, winAmount: 5.00, line: 1 },
    ],
    cascades: [],
    lightningMarks: [],
    freeLetterDelta: 0,
    totalWin: 5.00,
    triggerThunderBlessing: false,
    triggerFG: false,
  },

  // 2. Near Miss — close but no win
  near_miss: {
    id: 'near_miss',
    label: '差點中獎',
    grid: [
      ['ZEUS',    'COIN',   'HARP'],
      ['ZEUS',    'LAUREL', 'GEM'],
      ['EAGLE',   'ZEUS',   'HELMET'],
      ['TRIDENT', 'COIN',   'LAUREL'],
      ['ZEUS',    'HELMET', 'HARP'],
    ],
    wins: [],
    cascades: [],
    lightningMarks: [],
    freeLetterDelta: 0,
    totalWin: 0,
    triggerThunderBlessing: false,
    triggerFG: false,
    nearMiss: true,
    nearMissSymbol: 'ZEUS',
  },

  // 3. Cascade 3-steps — symbols explode, new ones drop in, win accumulates
  cascade_3steps: {
    id: 'cascade_3steps',
    label: '3次連鎖消除',
    grid: [
      ['ZEUS',    'ZEUS',   'EAGLE'],
      ['ZEUS',    'ZEUS',   'TRIDENT'],
      ['ZEUS',    'ZEUS',   'HELMET'],
      ['EAGLE',   'EAGLE',  'EAGLE'],
      ['EAGLE',   'COIN',   'HARP'],
    ],
    wins: [
      { symbolId: 'ZEUS', count: 5, winAmount: 50.00, line: 1, positions: [[0,0],[0,1],[1,0],[1,1],[2,0]] },
      { symbolId: 'ZEUS', count: 3, winAmount: 5.00,  line: 2, positions: [[0,2],[1,2],[2,2]] },
      { symbolId: 'EAGLE', count: 5, winAmount: 30.00, line: 3, positions: [[3,0],[3,1],[3,2],[4,0],[4,1]] },
    ],
    cascades: [
      {
        step: 1,
        explodedPositions: [[0,0],[0,1],[1,0],[1,1],[2,0],[0,2],[1,2],[2,2]],
        newSymbols: { 0: ['HELMET','HARP','COIN'], 1: ['LAUREL','GEM','HARP'], 2: ['COIN','GEM','ZEUS'] },
        stepWin: 85.00,
      },
      {
        step: 2,
        explodedPositions: [[3,0],[3,1],[3,2],[4,0]],
        newSymbols: { 3: ['HARP','TRIDENT','COIN'], 4: ['GEM','LAUREL','HARP'] },
        stepWin: 30.00,
        lightningMarks: [[2,1]],
      },
      {
        step: 3,
        explodedPositions: [[2,1]],
        newSymbols: { 2: ['ZEUS','EAGLE','HARP'] },
        stepWin: 12.00,
        freeLetterDelta: 1,
      },
    ],
    lightningMarks: [[2,1]],
    freeLetterDelta: 1,
    totalWin: 127.00,
    triggerThunderBlessing: false,
    triggerFG: false,
  },

  // 4. Thunder Blessing — SC accumulate lightning marks, burst
  thunder_blessing: {
    id: 'thunder_blessing',
    label: '雷霆祝福觸發',
    grid: [
      ['SCATTER',  'ZEUS',    'SCATTER'],
      ['EAGLE',    'SCATTER', 'HARP'],
      ['TRIDENT',  'COIN',    'SCATTER'],
      ['HELMET',   'SCATTER', 'LAUREL'],
      ['GEM',      'EAGLE',   'HARP'],
    ],
    wins: [
      { symbolId: 'SCATTER', count: 5, winAmount: 0, isThunderBlessing: true },
    ],
    cascades: [],
    lightningMarks: [
      [0,0],[0,2],[1,1],[2,2],[3,1]
    ],
    thunderBlessingTargets: [
      { col:0, row:1, symbol:'EAGLE', newSymbol:'ZEUS' },
      { col:1, row:0, symbol:'ZEUS',  newSymbol:'ZEUS' },
      { col:2, row:1, symbol:'HARP',  newSymbol:'ZEUS' },
      { col:3, row:2, symbol:'LAUREL',newSymbol:'ZEUS' },
      { col:4, row:0, symbol:'GEM',   newSymbol:'ZEUS' },
    ],
    freeLetterDelta: 2,
    totalWin: 250.00,
    triggerThunderBlessing: true,
    triggerFG: false,
    thunderBlessingWin: 250.00,
  },

  // 5. Full FG run — cascade triggers FREE, Coin Toss sequence, FG with multiplier
  full_fg_run: {
    id: 'full_fg_run',
    label: '完整自由遊戲流程',
    grid: [
      ['ZEUS',    'ZEUS',    'EAGLE'],
      ['ZEUS',    'ZEUS',    'TRIDENT'],
      ['ZEUS',    'EAGLE',   'HELMET'],
      ['EAGLE',   'EAGLE',   'EAGLE'],
      ['TRIDENT', 'COIN',    'HARP'],
    ],
    wins: [
      { symbolId: 'ZEUS', count: 5, winAmount: 50.00 },
      { symbolId: 'EAGLE', count: 4, winAmount: 20.00 },
    ],
    cascades: [
      {
        step: 1,
        explodedPositions: [[0,0],[0,1],[0,2],[1,0],[1,1],[2,0]],
        stepWin: 70.00,
        freeLetterDelta: 2,
      },
      {
        step: 2,
        explodedPositions: [[3,0],[3,1],[3,2]],
        stepWin: 40.00,
        freeLetterDelta: 2,
      },
    ],
    lightningMarks: [[2,2],[4,1]],
    freeLetterDelta: 4,
    totalWin: 110.00,
    triggerThunderBlessing: false,
    triggerFG: true,   // FREE letters filled → Coin Toss
    coinTossSequence: [
      { toss: 1, result: 'HEADS', prob: 0.80, multiplierReached: 3 },
      { toss: 2, result: 'HEADS', prob: 0.68, multiplierReached: 7 },
      { toss: 3, result: 'HEADS', prob: 0.56, multiplierReached: 17 },
      { toss: 4, result: 'TAILS', prob: 0.48, finalMultiplier: 17 },
    ],
    finalFGMultiplier: 17,
    fgSpins: 10,
    fgTotalWin: 1870.00, // 110× base wins × 17 multiplier applied
  },

  // 6. Max Win result — for demonstration
  max_win_demo: {
    id: 'max_win_demo',
    label: 'MAX WIN 展示 (×30,000)',
    grid: [
      ['ZEUS', 'ZEUS', 'ZEUS', 'ZEUS', 'ZEUS'],
      ['WILD', 'WILD', 'WILD', 'WILD', 'WILD'],
      ['ZEUS', 'ZEUS', 'ZEUS', 'ZEUS', 'ZEUS'],
    ].map(row => Array.from({length:5}, (_,i) => row[i] || 'ZEUS')),
    wins: [
      { symbolId: 'ZEUS', count: 5, winAmount: 300000.00, isCapped: true, capMultiplier: 30000 },
    ],
    cascades: [],
    lightningMarks: [],
    freeLetterDelta: 0,
    totalWin: 300000.00,
    cappedWin: 30000, // 30000× BET
    triggerThunderBlessing: false,
    triggerFG: false,
    isMaxWin: true,
  },
};

// Reshaped grid helper: SPIN_RESULTS grids are stored col-first
// Grid[col][row] — col 0..4, row 0..2 (top to bottom)
function getGridForDisplay(result) {
  const raw = result.grid;
  if (!raw) return generateRandomGrid();
  // If array of cols (each col is array of rows)
  if (Array.isArray(raw[0])) return raw;
  return generateRandomGrid();
}

// ============================================================
// PLAYER STATE
// ============================================================
const PLAYER_STATE = {
  balance: 1000.00,
  currency: 'USD',
  betIndex: 7,  // → $2.00
  extraBetActive: false,
  sessionWin: 0,
  sessionSpins: 0,
  freeLetterProgress: 0,   // 0–4 (need 5 FREE letters → Coin Toss)
  lightningMarks: [],       // array of {col, row}
  fgActive: false,
  fgSpinsRemaining: 0,
  fgMultiplierLevel: 0,     // 0–4 index into [3,7,17,27,77]
  fgTotalWin: 0,
  coinTossHeads: 0,         // accumulated HEADS this Coin Toss round
  rowCount: 3,              // current row count (3 or 6)
  lastResult: null,
};

// ============================================================
// COIN TOSS STATE HELPER
// ============================================================
function getCoinTossStage(headsCount) {
  // headsCount 0→1→2→3→4→5 maps to multiplier index
  // Each HEADS advances one step: ×3, ×7, ×17, ×27, ×77
  return Math.min(headsCount, GAME_CONFIG.fgMultipliers.length - 1);
}

function getCoinTossProb(headsCount) {
  if (headsCount >= GAME_CONFIG.coinProbs.length) return 0;
  return GAME_CONFIG.coinProbs[headsCount];
}

// ============================================================
// WIN TIER CLASSIFIER
// ============================================================
function classifyWin(totalWin, baseBet) {
  const multiple = totalWin / baseBet;
  const tiers = GAME_CONFIG.winTiers;
  if (multiple >= tiers.maxwin.min) return tiers.maxwin;
  if (multiple >= tiers.jackpot.min) return tiers.jackpot;
  if (multiple >= tiers.mega.min) return tiers.mega;
  if (multiple >= tiers.big.min) return tiers.big;
  return tiers.normal;
}

// ============================================================
// BET HELPERS
// ============================================================
function getBaseBet(state) {
  const levels = state.currency === 'USD'
    ? GAME_CONFIG.betLevelsUSD
    : GAME_CONFIG.betLevelsTWD;
  return levels[state.betIndex] || levels[0];
}

function getTotalBet(state) {
  const base = getBaseBet(state);
  return state.extraBetActive ? base * GAME_CONFIG.extraBetMultiplier : base;
}

function getBuyFeatureCost(state) {
  return getBaseBet(state) * GAME_CONFIG.buyFeatureMultiplier;
}

function getCurrencySymbol(currency) {
  return GAME_CONFIG.currency[currency] || '$';
}

function formatAmount(amount, currency) {
  const sym = getCurrencySymbol(currency);
  if (currency === 'TWD') {
    return `${sym}${Math.round(amount).toLocaleString()}`;
  }
  return `${sym}${amount.toFixed(2)}`;
}

// ============================================================
// PAYTABLE DATA (for screen-11)
// ============================================================
const PAYTABLE = {
  highSymbols: [
    { ...SYMBOLS.ZEUS,    categoryLabel: '最高符號' },
    { ...SYMBOLS.EAGLE,   categoryLabel: '高符號' },
    { ...SYMBOLS.TRIDENT, categoryLabel: '高符號' },
  ],
  lowSymbols: [
    { ...SYMBOLS.HELMET },
    { ...SYMBOLS.HARP },
    { ...SYMBOLS.LAUREL },
    { ...SYMBOLS.COIN },
    { ...SYMBOLS.GEM },
  ],
  specialSymbols: [
    { ...SYMBOLS.WILD },
    { ...SYMBOLS.SCATTER },
    { ...SYMBOLS.LIGHTNING_MARK },
  ],
  features: [
    {
      id: 'cascade',
      title: '⚡ Cascade 連鎖消除',
      desc: '每次消除後，上方符號下落填補空位。新符號繼續形成獲勝組合，直到無法再獲勝為止。',
      rules: [
        '每次 Cascade 後持續計算 FREE 字母進度',
        '每次 Cascade 產生的雷印記會保留至本輪結束',
        'Cascade 獲勝倍率不累加（以各次獨立計算）',
      ],
    },
    {
      id: 'free_letter',
      title: '🔤 FREE 字母積累',
      desc: '每次 Cascade 消除可積累 FREE 字母進度。集滿 F-R-E-E 四個字母後觸發 Coin Toss。',
      rules: [
        'FREE = 4 個字母需逐一積累',
        'Cascade 每步驟 +1～+2 進度',
        'SC 符號命中可額外 +2 進度',
        '進入 FG 後重置',
      ],
    },
    {
      id: 'coin_toss',
      title: '🪙 Coin Toss 硬幣翻轉',
      desc: '觸發後進入一系列硬幣翻轉。每次 HEADS 可解鎖更高的 FG 倍率。TAILS 則停止翻轉，以當前倍率進入 Free Game。',
      rules: [
        '連續5次 HEADS → ×77 最高倍率',
        '第1次 HEADS 機率：80%',
        '第2次 HEADS 機率：68%',
        '第3次 HEADS 機率：56%',
        '第4次 HEADS 機率：48%',
        '第5次 HEADS 機率：40%',
        'TAILS → 立即以當前倍率進入 Free Game',
      ],
    },
    {
      id: 'free_game',
      title: '🎯 Free Game 自由遊戲',
      desc: '進入 Free Game 後，所有獲勝金額乘以當前倍率（×3/×7/×17/×27/×77）。',
      rules: [
        '預設 10 次 FG Spin',
        'FG 期間亦可觸發 Cascade 與 Thunder Blessing',
        'FG 期間 Coin Toss 保持當前倍率不再上升',
        'FG 結束後結算所有獲勝並返回主遊戲',
      ],
    },
    {
      id: 'thunder_blessing',
      title: '⚡ Thunder Blessing 雷霆祝福',
      desc: '5個以上 SC 符號同時出現時觸發。所有帶有雷印記的符號位置引爆並轉換為高價值符號，觸發大規模獲勝。',
      rules: [
        'SC ×5+ → 觸發雷霆祝福',
        '所有雷印記位置轉換為 ZEUS 符號',
        '轉換完成後重新計算獲勝',
        '觸發後 FREE 字母 +2',
      ],
    },
  ],
  lines: {
    count: 57,
    desc: '共 57 條固定連線，從左至右計算。3 個或以上相同符號連續出現在同一條連線上即獲勝。',
  },
};

// ============================================================
// EXPORT
// ============================================================
window.MOCK_DATA = {
  GAME_CONFIG,
  SYMBOLS,
  SYMBOL_KEYS,
  REEL_POOL,
  SPIN_RESULTS,
  PLAYER_STATE,
  PAYTABLE,
  // helpers
  randomSymbol,
  generateRandomGrid,
  getGridForDisplay,
  getBaseBet,
  getTotalBet,
  getBuyFeatureCost,
  getCurrencySymbol,
  formatAmount,
  classifyWin,
  getCoinTossProb,
  getCoinTossStage,
  getSymbolList,
};

console.log('[MockData] Loaded — Thunder Blessing v1.0.0-prototype');
