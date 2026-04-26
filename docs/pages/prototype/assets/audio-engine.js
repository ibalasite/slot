/**
 * Thunder Blessing — Audio Engine
 * Web Audio API synthesis engine (no external audio files).
 * All BGM and SFX are generated via OscillatorNode + GainNode.
 */

'use strict';

// ============================================================
// BGM DEFINITIONS
// Each entry describes a looping melodic pattern synthesised
// with oscillators.  Note values are MIDI-style Hz arrays.
// ============================================================
const BGM_DEFS = {
  BGM_LOBBY: {
    notes: [262, 294, 330, 349, 392, 349, 330, 294],
    noteDur: 0.42, type: 'triangle', baseVol: 0.14,
    drone: 98, droneVol: 0.07,
  },
  BGM_MAINGAME: {
    notes: [220, 247, 262, 294, 330, 294, 262, 247],
    noteDur: 0.34, type: 'sine', baseVol: 0.11,
    drone: 73.4, droneVol: 0.05,
    beat: { freq: 50, rate: 0.68, beatVol: 0.05 },
  },
  BGM_FG: {
    notes: [330, 392, 440, 523, 587, 523, 440, 392],
    noteDur: 0.27, type: 'sawtooth', baseVol: 0.10,
    drone: 55, droneVol: 0.06,
    beat: { freq: 60, rate: 0.545, beatVol: 0.08 },
  },
};

// ============================================================
// SFX DEFINITIONS
// { freq, type, attack, decay, sustain, release, vol }
// ============================================================
const SFX_DEFS = {
  'SFX-SPIN':      { freq: 220, type:'sawtooth',  a:0.01, d:0.10, s:0.40, r:0.20, vol:0.40 },
  'SFX-CASCADE':   { freq: 440, type:'triangle',  a:0.01, d:0.15, s:0.20, r:0.25, vol:0.50 },
  'SFX-THUNDER':   { freq: 55,  type:'sawtooth',  a:0.001,d:0.60, s:0.10, r:0.80, vol:0.80 },
  'SFX-COINTOSS':  { freq: 740, type:'triangle',  a:0.01, d:0.08, s:0.05, r:0.20, vol:0.60 },
  'SFX-WIN-SMALL': { freq: 523, type:'sine',      a:0.02, d:0.20, s:0.30, r:0.40, vol:0.50 },
  'SFX-WIN-BIG':   { freq: 659, type:'sine',      a:0.03, d:0.30, s:0.50, r:0.60, vol:0.70 },
  'SFX-WIN-MEGA':  { freq: 784, type:'sine',      a:0.04, d:0.40, s:0.70, r:0.80, vol:0.85 },
  'SFX-REEL-STOP': { freq: 330, type:'square',    a:0.001,d:0.05, s:0.10, r:0.15, vol:0.35 },
  'SFX-BUTTON':    { freq:1200, type:'triangle',  a:0.001,d:0.04, s:0.01, r:0.05, vol:0.25 },
  'SFX-COIN-HEADS':{ freq:1047, type:'sine',      a:0.01, d:0.10, s:0.15, r:0.30, vol:0.70 },
  'SFX-COIN-TAILS':{ freq: 262, type:'square',    a:0.01, d:0.10, s:0.10, r:0.30, vol:0.50 },
  'SFX-LETTER-LIT':{ freq: 880, type:'sine',      a:0.01, d:0.10, s:0.10, r:0.20, vol:0.55 },
  'SFX-BUY':       { freq: 659, type:'sine',      a:0.02, d:0.30, s:0.40, r:0.50, vol:0.65 },
};

// Screen → BGM mapping
const SCREEN_BGM = {
  'screen-01': null,
  'screen-02': 'BGM_LOBBY',
  'screen-03': 'BGM_MAINGAME',
  'screen-04': 'BGM_MAINGAME',
  'screen-05': 'BGM_MAINGAME',
  'screen-06': null,           // thunder sequence overrides
  'screen-07': 'BGM_MAINGAME',
  'screen-08': 'BGM_FG',
  'screen-09': null,           // win sound overrides
  'screen-10': 'BGM_LOBBY',
  'screen-11': 'BGM_LOBBY',
  'screen-12': 'BGM_LOBBY',
};

// ============================================================
// AudioEngine Class
// ============================================================
class AudioEngine {
  constructor() {
    this._ctx = null;
    this._unlocked = false;
    this._bgmGain = null;
    this._sfxGain = null;
    this._bgmNodes = [];       // active BGM oscillators
    this._bgmIntervals = [];   // tracked setInterval IDs for melody loops
    this._bgmGeneration = 0;   // incremented on every stopBGM to cancel beat timers
    this._currentBGM = null;
    this._bgmVol = 0.7;        // 0–1 master BGM volume
    this._sfxVol = 0.8;        // 0–1 master SFX volume
    this._muted = false;
  }

  // ----------------------------------------------------------
  // INIT / UNLOCK
  // Must be called from a user-gesture handler on iOS/Safari.
  // ----------------------------------------------------------
  async unlock() {
    if (this._unlocked) return true;
    try {
      if (!this._ctx) {
        this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this._ctx.state === 'suspended') {
        await this._ctx.resume();
      }
      // Unlock with a silent buffer
      const buf = this._ctx.createBuffer(1, 1, 22050);
      const src = this._ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this._ctx.destination);
      src.start(0);

      // Master gains
      this._bgmGain = this._ctx.createGain();
      this._sfxGain = this._ctx.createGain();
      this._bgmGain.gain.value = this._bgmVol * 0.4;
      this._sfxGain.gain.value = this._sfxVol;
      this._bgmGain.connect(this._ctx.destination);
      this._sfxGain.connect(this._ctx.destination);

      this._unlocked = true;
      return true;
    } catch (err) {
      console.warn('[AudioEngine] unlock failed:', err);
      return false;
    }
  }

  // ----------------------------------------------------------
  // VOLUME CONTROL
  // ----------------------------------------------------------
  setVolume(bgm, sfx) {
    this._bgmVol = Math.max(0, Math.min(1, bgm));
    this._sfxVol = Math.max(0, Math.min(1, sfx));
    // Guard: ctx may not exist yet if audio was never unlocked
    if (this._bgmGain && this._ctx) {
      this._bgmGain.gain.setTargetAtTime(this._bgmVol * 0.4, this._ctx.currentTime, 0.05);
    }
    if (this._sfxGain && this._ctx) {
      this._sfxGain.gain.setTargetAtTime(this._sfxVol, this._ctx.currentTime, 0.05);
    }
  }

  setBGMVolume(v) { this.setVolume(v, this._sfxVol); }
  setSFXVolume(v) { this.setVolume(this._bgmVol, v); }

  // ----------------------------------------------------------
  // BGM
  // ----------------------------------------------------------
  playBGM(id, opts = {}) {
    if (!this._unlocked || !this._ctx) return;
    const def = BGM_DEFS[id];
    if (!def) return;
    if (this._currentBGM === id && !opts.force) return;

    this.stopBGM();
    this._currentBGM = id;
    this._startMelodicBGM(def);
  }

  stopBGM() {
    if (!this._ctx) return;
    // Increment generation so all in-flight beat setTimeout callbacks
    // belonging to the previous BGM session see a stale generation and
    // self-terminate without rescheduling.
    this._bgmGeneration++;

    // Clear all tracked melody setInterval IDs.
    for (const id of this._bgmIntervals) clearInterval(id);
    this._bgmIntervals = [];

    const now = this._ctx.currentTime;
    for (const node of this._bgmNodes) {
      try {
        if (node.gain) node.gain.setTargetAtTime(0, now, 0.2);
        node.stop(now + 0.4);
      } catch (_) { /* already stopped */ }
    }
    this._bgmNodes = [];
    this._currentBGM = null;
  }

  _startMelodicBGM(def) {
    if (!this._bgmGain) return;
    const ctx = this._ctx;
    const { notes, noteDur, type, baseVol, drone, droneVol, beat } = def;

    // Snapshot the generation at the moment this BGM session starts.
    // Any timer callback that sees a different value knows it is stale.
    const myGeneration = this._bgmGeneration;

    // Melody oscillator
    const melOsc = ctx.createOscillator();
    const melGain = ctx.createGain();
    melOsc.type = type || 'sine';
    melGain.gain.value = 0;
    melOsc.connect(melGain);
    melGain.connect(this._bgmGain);

    let noteIdx = 0;
    const scheduleNote = () => {
      // Bail out if this session has been superseded by a stopBGM/new BGM.
      if (this._bgmGeneration !== myGeneration) return;
      const freq = notes[noteIdx % notes.length];
      const t = ctx.currentTime;
      melOsc.frequency.setValueAtTime(freq || 1, t);
      melGain.gain.cancelScheduledValues(t);
      melGain.gain.setValueAtTime(0, t);
      melGain.gain.linearRampToValueAtTime(baseVol, t + 0.05);
      melGain.gain.setTargetAtTime(baseVol * 0.6, t + noteDur * 0.6, 0.08);
      noteIdx++;
    };

    melOsc.start();
    this._bgmNodes.push(melOsc);
    scheduleNote();

    // Store the interval ID so stopBGM() can clearInterval it immediately.
    const intervalId = setInterval(() => {
      if (this._bgmGeneration !== myGeneration) {
        clearInterval(intervalId);
        return;
      }
      scheduleNote();
    }, noteDur * 1000);
    this._bgmIntervals.push(intervalId);

    // Drone oscillator
    if (drone && this._bgmGain) {
      const droneOsc = ctx.createOscillator();
      const droneGain = ctx.createGain();
      droneOsc.type = 'sine';
      droneOsc.frequency.value = drone;
      droneGain.gain.value = droneVol * this._bgmVol;
      droneOsc.connect(droneGain);
      droneGain.connect(this._bgmGain);
      droneOsc.start();
      this._bgmNodes.push(droneOsc);
    }

    // Kick beat
    if (beat) {
      this._scheduleBeat(beat, myGeneration);
    }
  }

  _scheduleBeat({ freq, rate, beatVol }, myGeneration) {
    if (!this._bgmGain) return;
    const ctx = this._ctx;
    const intervalMs = Math.max(50, (1 / rate) * 1000);

    const fire = () => {
      // Bail out immediately — no reschedule — if the BGM session ended.
      if (this._bgmGeneration !== myGeneration) return;

      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(beatVol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(this._bgmGain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);

      // Only reschedule if still in the same BGM session.
      if (this._bgmGeneration === myGeneration) {
        setTimeout(fire, intervalMs);
      }
    };
    setTimeout(fire, 200);
  }

  // ----------------------------------------------------------
  // SFX
  // ----------------------------------------------------------
  playSFX(id) {
    if (!this._unlocked || !this._ctx || this._muted) return;
    const def = SFX_DEFS[id];
    if (!def) return;
    this._playEnvelope(def);
  }

  _playEnvelope({ freq, type, a, d, s, r, vol }) {
    const ctx = this._ctx;
    const now = ctx.currentTime;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + a);
    gain.gain.linearRampToValueAtTime(vol * s, now + a + d);
    gain.gain.setTargetAtTime(0, now + a + d, r * 0.4);

    osc.connect(gain);
    gain.connect(this._sfxGain || this._ctx.destination);
    osc.start(now);
    osc.stop(now + a + d + r + 0.05);
  }

  // ----------------------------------------------------------
  // COMPOSITE SEQUENCES
  // ----------------------------------------------------------

  /** Called when a reel stops: stagger per-reel stop sounds */
  playReelStops(count = 5) {
    for (let i = 0; i < count; i++) {
      setTimeout(() => this.playSFX('SFX-REEL-STOP'), i * 120);
    }
  }

  /** Thunder Blessing: low boom then rising cascade of tones */
  playThunderBlessingSequence() {
    this.playSFX('SFX-THUNDER');
    const rising = [440, 523, 659, 784, 1047];
    rising.forEach((f, i) => {
      setTimeout(() => {
        if (!this._unlocked || !this._ctx) return;
        this._playEnvelope({ freq: f, type:'sine', a:0.01, d:0.12, s:0.1, r:0.3, vol:0.55 });
      }, 300 + i * 140);
    });
  }

  /** Coin flip: rapid pitch sweep */
  playCoinFlip() {
    if (!this._unlocked || !this._ctx) return;
    const ctx = this._ctx;
    const now = ctx.currentTime;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(1200, now + 0.3);
    osc.frequency.linearRampToValueAtTime(300, now + 0.6);
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.setTargetAtTime(0, now + 0.55, 0.08);
    osc.connect(gain);
    gain.connect(this._sfxGain || ctx.destination);
    osc.start(now);
    osc.stop(now + 0.7);
  }

  /** Play win sound based on tier */
  playWinSound(tier) {
    const map = {
      normal: 'SFX-WIN-SMALL',
      big:    'SFX-WIN-BIG',
      mega:   'SFX-WIN-MEGA',
      ultra:  'SFX-WIN-MEGA',
      maxwin: 'SFX-WIN-MEGA',
    };
    this.playSFX(map[tier] || 'SFX-WIN-SMALL');
    // Additional fanfare for mega+
    if (tier === 'mega' || tier === 'ultra' || tier === 'maxwin') {
      const fanfare = [523, 659, 784, 1047];
      fanfare.forEach((f, i) => {
        setTimeout(() => {
          if (!this._unlocked || !this._ctx) return;
          this._playEnvelope({ freq:f, type:'sine', a:0.02, d:0.3, s:0.5, r:0.4, vol:0.6 });
        }, 200 + i * 180);
      });
    }
  }

  /** Called by router when navigating to a screen */
  bindToScreen(screenId) {
    const bgmId = SCREEN_BGM[screenId];
    if (bgmId) this.playBGM(bgmId);
    // Win screen / thunder screen have no auto-BGM — handled by their bind functions
  }
}

window.AudioEngine = AudioEngine;
