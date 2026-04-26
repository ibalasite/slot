/**
 * Thunder Blessing Slot — Mock Data Module
 * Symbols, bet levels, spin results, session data, paytable
 */

'use strict';

// ============================================================
// GAME CONFIGURATION
// ============================================================
const GAME_CONFIG = {
  title: 'Thunder Blessing',
  titleZh: '雷神賜福',
  version: '1.0.0-prototype',
  reels: 5,
  rows: { min: 3, max: 6 },
  lines: 57,
  rtp: 96.5,
  maxWinMultiplier: 30000,

  betLevelsUSD: [0.1, 0.2, 0.5, 1.0, 2.0, 5.0, 10.0, 20.0, 50.0, 100.0, 200.0, 500.0],
  betLevelsTWD: [3, 6, 15, 30, 60, 150, 300, 600, 1500, 3000, 6000, 15000],

  defaultBetIndexUSD: 4,    // $2.00
  defaultBetIndexTWD: 4,    // NT$60
  extraBetMultiplier: 3,
  buyFeatureMultiplier: 100,

  fgMultipliers: [3, 7, 17, 27, 77],
  fgSpinsPerRound: 10,

  coinProbs: [0.80, 0.68, 0.56, 0.48, 0.40],
  coinTossesNeeded: 5,

  winTiers: {
    normal:  { min: 1,    max: 4.99,   label: 'WIN',        tier: 'normal',     stars: 1 },
    big:     { min: 5,    max: 14.99,  label: 'BIG WIN',    tier: 'big',        stars: 2 },
    mega:    { min: 15,   max: 49.99,  label: 'MEGA WIN',   tier: 'mega',       stars: 3 },
    ultra:   { min: 50,   max: 999.99, label: 'ULTRA WIN',  tier: 'ultra',      stars: 4 },
    maxwin:  { min: 1000, max: 30000,  label: 'MAX WIN ×30,000', tier: 'maxwin', stars: 5 },
  },

  currency: { USD: '$', TWD: 'NT$' },
};

// ============================================================
// SYMBOLS
// ============================================================
const SYMBOLS = {
  WILD:     { id: 'WILD',     emoji: '⚡', name: 'Wild',      color: '#FFE55C', glow: '#FFD700', isWild: true,  isScatter: false },
  SCATTER:  { id: 'SCATTER',  emoji: '☈',  name: 'Thunder SC',color: '#FF8C00', glow: '#FFA500', isWild: false, isScatter: true  },
  P1:       { id: 'P1',       emoji: '🌩', name: 'Zeus',      color: '#DCA331', glow: '#FFD700', isWild: false, isScatter: false },
  P2:       { id: 'P2',       emoji: '🦅', name: 'Athena',    color: '#C0C0C0', glow: '#E8E8E8', isWild: false, isScatter: false },
  P3:       { id: 'P3',       emoji: '🔱', name: 'Poseidon',  color: '#4A7FA5', glow: '#6BAFDF', isWild: false, isScatter: false },
  P4:       { id: 'P4',       emoji: '🌿', name: 'Hera',      color: '#22C55E', glow: '#4ADE80', isWild: false, isScatter: false },
  L1:       { id: 'L1',       emoji: '⚡', name: 'Bolt',      color: '#DCA331', glow: '#FFD700', isWild: false, isScatter: false },
  L2:       { id: 'L2',       emoji: '🦅', name: 'Eagle',     color: '#A07840', glow: '#C09060', isWild: false, isScatter: false },
  L3:       { id: 'L3',       emoji: '🔱', name: 'Trident',   color: '#607080', glow: '#809090', isWild: false, isScatter: false },
  L4:       { id: 'L4',       emoji: '👑', name: 'Crown',     color: '#DCA331', glow: '#FFD700', isWild: false, isScatter: false },
};

// Reel pool — weighted for realistic distribution
const REEL_POOL = ['P1','P1','P2','P2','P3','P3','P4','P4','L1','L1','L1','L2','L2','L2','L3','L3','L3','L4','L4','L4','WILD','SCATTER'];

// ============================================================
// HELPER FUNCTIONS
// ============================================================
function randomSymbol() {
  return REEL_POOL[Math.floor(Math.random() * REEL_POOL.length)];
}

function generateRandomGrid(cols, rows) {
  const grid = [];
  for (let c = 0; c < cols; c++) {
    const col = [];
    for (let r = 0; r < rows; r++) col.push(randomSymbol());
    grid.push(col);
  }
  return grid;
}

function getBaseBet(state) {
  if (!state || typeof state !== 'object') return GAME_CONFIG.betLevelsUSD[4];
  const levels = state.currency === 'TWD' ? GAME_CONFIG.betLevelsTWD : GAME_CONFIG.betLevelsUSD;
  const idx = Number.isFinite(state.betIndex) ? Math.max(0, Math.min(state.betIndex, levels.length - 1)) : 4;
  return levels[idx];
}

function getTotalBet(state) {
  const base = getBaseBet(state);
  return (state && state.extraBetActive) ? base * GAME_CONFIG.extraBetMultiplier : base;
}

function getBuyFeatureCost(state) {
  return getTotalBet(state) * GAME_CONFIG.buyFeatureMultiplier;
}

function formatAmount(amount, currency) {
  const n = Number.isFinite(amount) ? amount : 0;
  const sym = (currency && GAME_CONFIG.currency[currency]) ? GAME_CONFIG.currency[currency] : '$';
  if (currency === 'TWD') return `${sym}${Math.round(n).toLocaleString()}`;
  return `${sym}${Math.abs(n).toFixed(2)}`;
}

function classifyWin(amount, totalBet) {
  const n = Number.isFinite(amount) ? amount : 0;
  const bet = Number.isFinite(totalBet) && totalBet > 0 ? totalBet : 1;
  if (n <= 0) return GAME_CONFIG.winTiers.normal;
  const mult = n / bet;
  for (const [, tier] of Object.entries(GAME_CONFIG.winTiers)) {
    if (mult >= tier.min && mult <= tier.max) return tier;
  }
  return GAME_CONFIG.winTiers.maxwin;
}

function getCoinTossProb(headsCount) {
  const idx = Number.isFinite(headsCount) ? Math.max(0, headsCount) : 0;
  return GAME_CONFIG.coinProbs[idx] ?? 0;
}

// ============================================================
// SESSION / PLAYER STATE
// ============================================================
// Session ID uses a fixed prototype prefix + random hex suffix (not used for security,
// purely for display purposes in this client-side demo — no server auth involved).
const PLAYER_STATE = {
  playerId:  'proto-player-001',
  sessionId: 'sess-proto-' + Math.random().toString(36).slice(2, 10),
  balance:   1250.50,
  currency:  'USD',
  betIndex:  4,
  extraBetActive: false,
};

// ============================================================
// SPIN RESULT SAMPLES (6 realistic scenarios)
// ============================================================
const SPIN_RESULTS = [
  // 0: Normal win — 3-of-a-kind Zeus
  {
    spinId: 'spin-001',
    label: 'Normal Win',
    betAmount: 2.00,
    baseWin:   6.00,
    totalWin:  6.00,
    grid: [
      ['P1','L1','L3'],
      ['P1','L2','P4'],
      ['P1','L4','L1'],
      ['L3','P3','L2'],
      ['L2','P4','L4'],
    ],
    winPositions: [[0,0],[1,0],[2,0]],
    cascades: [],
    isThunderBlessing: false,
    coinToss: null,
    fgRounds: null,
    freeLetterDelta: 0,
  },

  // 1: Cascade win — 3 cascade steps
  {
    spinId: 'spin-002',
    label: 'Cascade Win (3 steps)',
    betAmount: 2.00,
    baseWin:   8.00,
    totalWin:  89.50,
    grid: [
      ['P1','P1','L1'],
      ['P1','P1','L2'],
      ['P1','P1','L3'],
      ['L2','L2','L2'],
      ['P3','L4','L1'],
    ],
    winPositions: [[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]],
    cascades: [
      { step:1, eliminated:[[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]], stepWin:8.00,  rowExpand:null },
      { step:2, eliminated:[[3,0],[3,1],[3,2]], stepWin:18.50, rowExpand:4 },
      { step:3, eliminated:[[0,0],[1,0],[2,0]], stepWin:63.00, rowExpand:5 },
    ],
    isThunderBlessing: false,
    coinToss: null,
    fgRounds: null,
    freeLetterDelta: 1,
  },

  // 2: Thunder Blessing trigger (5 scatters)
  {
    spinId: 'spin-003',
    label: 'Thunder Blessing Trigger',
    betAmount: 2.00,
    baseWin:   0,
    totalWin:  240.00,
    grid: [
      ['SCATTER','P1',     'SCATTER'],
      ['P2',     'SCATTER','L2'     ],
      ['L3',     'P4',     'SCATTER'],
      ['L1',     'SCATTER','P3'     ],
      ['P4',     'L4',     'L2'     ],
    ],
    winPositions: [[0,0],[0,2],[1,1],[2,2],[3,1]],
    cascades: [],
    isThunderBlessing: true,
    thunderBlessingWin: 240.00,
    scatterPositions: [[0,0],[0,2],[1,1],[2,2],[3,1]],
    coinToss: null,
    fgRounds: null,
    freeLetterDelta: 2,
  },

  // 3: Free Game trigger via Coin Toss (×17 multiplier achieved)
  {
    spinId: 'spin-004',
    label: 'Free Game Trigger (×17 mult)',
    betAmount: 2.00,
    baseWin:   15.00,
    totalWin:  15.00,
    grid: [
      ['P1','P1','L1'],
      ['L2','P2','P4'],
      ['P3','L3','L4'],
      ['L1','P4','P2'],
      ['P2','L2','P1'],
    ],
    winPositions: [[0,0],[1,0]],
    cascades: [],
    isThunderBlessing: false,
    coinToss: {
      sequence: [
        { toss:1, result:'HEADS', prob:0.80, multReached:3  },
        { toss:2, result:'HEADS', prob:0.68, multReached:7  },
        { toss:3, result:'HEADS', prob:0.56, multReached:17 },
        { toss:4, result:'TAILS', prob:0.48, finalMult:17   },
      ],
      finalMultiplier: 17,
    },
    fgRounds: {
      totalSpins: 10,
      multiplier: 17,
      totalFGWin: 1870.00,
    },
    freeLetterDelta: 4,
    triggeredFG: true,
  },

  // 4: Big Win — high-value symbol cluster
  {
    spinId: 'spin-005',
    label: 'Big Win (×18 bet)',
    betAmount: 2.00,
    baseWin:   36.00,
    totalWin:  36.00,
    grid: [
      ['P1','P1','P2'],
      ['P1','P1','L1'],
      ['P1','P2','L2'],
      ['P2','P1','L3'],
      ['L4','L2','P4'],
    ],
    winPositions: [[0,0],[1,0],[2,0],[0,1],[1,1],[3,1]],
    cascades: [],
    isThunderBlessing: false,
    coinToss: null,
    fgRounds: null,
    freeLetterDelta: 0,
  },

  // 5: No win — near miss scenario
  {
    spinId: 'spin-006',
    label: 'No Win (Near Miss)',
    betAmount: 2.00,
    baseWin:   0,
    totalWin:  0,
    grid: [
      ['P1','L2','P3'],
      ['L4','P1','L1'],
      ['P4','L3','P2'],
      ['L1','P3','L4'],
      ['P2','L4','P1'],
    ],
    winPositions: [],
    cascades: [],
    isThunderBlessing: false,
    coinToss: null,
    fgRounds: null,
    freeLetterDelta: 0,
  },
];

// ============================================================
// PAYTABLE
// ============================================================
const PAYTABLE = {
  highSymbols: [
    { id:'P1', emoji:'🌩', name:'Zeus',     payouts:{ 3:5,  4:20,  5:100 } },
    { id:'P2', emoji:'🦅', name:'Athena',   payouts:{ 3:3,  4:12,  5:50  } },
    { id:'P3', emoji:'🔱', name:'Poseidon', payouts:{ 3:2,  4:8,   5:30  } },
    { id:'P4', emoji:'🌿', name:'Hera',     payouts:{ 3:1.5,4:6,   5:20  } },
  ],
  lowSymbols: [
    { id:'L1', emoji:'⚡', name:'Bolt',     payouts:{ 3:1,  4:3,   5:10  } },
    { id:'L2', emoji:'🦅', name:'Eagle',    payouts:{ 3:0.8,4:2.5, 5:8   } },
    { id:'L3', emoji:'🔱', name:'Trident',  payouts:{ 3:0.6,4:2,   5:6   } },
    { id:'L4', emoji:'👑', name:'Crown',    payouts:{ 3:0.5,4:1.5, 5:5   } },
  ],
  features: [
    {
      title: '⚡ Wild Symbol',
      desc:  'Wild substitutes for all symbols except Thunder SC. Appears on all reels.',
      rules: ['Expands to fill reel on consecutive cascade wins', 'Does not pay independently'],
    },
    {
      title: '☈ Thunder Blessing (Scatter)',
      desc:  '3+ Scatters trigger Thunder Blessing bonus. Lightning marks convert adjacent low symbols to high symbols.',
      rules: ['3 SC: Convert 3 symbols', '4 SC: Convert 5 symbols', '5+ SC: Convert 8 symbols and fill FREE letters'],
    },
    {
      title: '🪙 Coin Toss',
      desc:  'After collecting 4 FREE letters via Thunder Blessing, enter Coin Toss to determine Free Game multiplier.',
      rules: ['HEADS (80%) → ×3', 'HEADS again (68%) → ×7', 'HEADS again (56%) → ×17', 'HEADS again (48%) → ×27', 'HEADS again (40%) → ×77', 'TAILS at any stage → Enter FG with current multiplier'],
    },
    {
      title: '🎰 Free Game',
      desc:  '10 free spins with the multiplier won in Coin Toss. All wins are multiplied.',
      rules: ['×3 / ×7 / ×17 / ×27 / ×77 multiplier applied to all wins', 'Cascade still active during FG', 'FG can re-trigger via Thunder Blessing'],
    },
    {
      title: '🔥 Cascade Elimination',
      desc:  'Winning symbols are eliminated and new symbols fall from above. Reels expand from 3 rows up to 6 rows during cascade chains.',
      rules: ['3 row → 4 row (after 1st cascade)', '4 row → 5 row (after 2nd cascade)', '5 row → 6 row (after 3rd cascade)', 'Resets to 3 rows after all cascades end'],
    },
  ],
};

// ============================================================
// SESSION HISTORY (last 10 spins)
// ============================================================
const SESSION_HISTORY = [
  { spinId:'h-001', bet:2.00, win:6.00,    result:'WIN',    time:'14:23:01', tier:'normal' },
  { spinId:'h-002', bet:2.00, win:0,       result:'NO WIN', time:'14:23:08', tier:'none'   },
  { spinId:'h-003', bet:2.00, win:89.50,   result:'CASCADE',time:'14:23:19', tier:'big'    },
  { spinId:'h-004', bet:2.00, win:0,       result:'NO WIN', time:'14:23:27', tier:'none'   },
  { spinId:'h-005', bet:2.00, win:240.00,  result:'THUNDER',time:'14:23:41', tier:'mega'   },
  { spinId:'h-006', bet:2.00, win:1870.00, result:'FG ×17', time:'14:24:03', tier:'ultra'  },
  { spinId:'h-007', bet:2.00, win:36.00,   result:'WIN',    time:'14:25:11', tier:'big'    },
  { spinId:'h-008', bet:2.00, win:0,       result:'NO WIN', time:'14:25:18', tier:'none'   },
  { spinId:'h-009', bet:2.00, win:12.00,   result:'WIN',    time:'14:25:25', tier:'normal' },
  { spinId:'h-010', bet:2.00, win:0,       result:'NO WIN', time:'14:25:33', tier:'none'   },
];

// Session summary stats
const SESSION_STATS = {
  totalSpins: 10,
  totalBet:   20.00,
  totalWin:   2253.50,
  biggestWin: 1870.00,
  biggestWinTier: 'ultra',
  winRate:    '60%',
  sessionDuration: '00:02:32',
  startTime:  '14:23:01',
  rtp:        '11267.5%',  // prototype exaggerated for demo
};

// ============================================================
// EXPORT
// ============================================================
window.MOCK_DATA = {
  GAME_CONFIG,
  SYMBOLS,
  REEL_POOL,
  SPIN_RESULTS,
  PLAYER_STATE,
  PAYTABLE,
  SESSION_HISTORY,
  SESSION_STATS,
  randomSymbol,
  generateRandomGrid,
  getBaseBet,
  getTotalBet,
  getBuyFeatureCost,
  formatAmount,
  classifyWin,
  getCoinTossProb,
};
