/**
 * Thunder Blessing — Audio Engine
 * Web Audio API sound engine using OscillatorNode synthesis
 * (no actual audio files required — all sounds are generated)
 */

// ============================================================
// AUDIO MAP — Screen to BGM mapping
// ============================================================
const AUDIO_MAP = {
  'screen-01': 'BGM_LOADING',
  'screen-02': 'BGM_LOBBY',
  'screen-03': 'BGM_MAIN',
  'screen-04': 'BGM_MAIN',
  'screen-05': 'BGM_CASCADE',
  'screen-06': 'BGM_THUNDER',
  'screen-07': 'BGM_COIN_TOSS',
  'screen-08': 'BGM_FREE_GAME',
  'screen-09': 'BGM_WIN',
  'screen-10': 'BGM_MAIN',
  'screen-11': 'BGM_MAIN',
  'screen-12': 'BGM_MAIN',
};

// SFX definitions: { freq, type, attack, decay, sustain, release, detune }
const SFX_MAP = {
  spin_start:   { freq: 220, type: 'sawtooth',  attack: 0.01, decay: 0.1,  sustain: 0.4, release: 0.2, vol: 0.4 },
  reel_stop:    { freq: 330, type: 'square',    attack: 0.001,decay: 0.05, sustain: 0.1, release: 0.15,vol: 0.35 },
  cascade:      { freq: 440, type: 'triangle',  attack: 0.01, decay: 0.15, sustain: 0.2, release: 0.25,vol: 0.5 },
  lightning:    { freq: 880, type: 'sawtooth',  attack: 0.001,decay: 0.05, sustain: 0.05,release: 0.3, vol: 0.7 },
  win_small:    { freq: 523, type: 'sine',      attack: 0.02, decay: 0.2,  sustain: 0.3, release: 0.4, vol: 0.5 },
  win_big:      { freq: 659, type: 'sine',      attack: 0.03, decay: 0.3,  sustain: 0.5, release: 0.6, vol: 0.7 },
  win_mega:     { freq: 784, type: 'sine',      attack: 0.04, decay: 0.4,  sustain: 0.7, release: 0.8, vol: 0.85},
  coin_toss:    { freq: 740, type: 'triangle',  attack: 0.01, decay: 0.08, sustain: 0.05,release: 0.2, vol: 0.6 },
  coin_heads:   { freq: 1047,type: 'sine',      attack: 0.01, decay: 0.1,  sustain: 0.15,release: 0.3, vol: 0.7 },
  coin_tails:   { freq: 262, type: 'square',    attack: 0.01, decay: 0.1,  sustain: 0.1, release: 0.3, vol: 0.5 },
  fg_enter:     { freq: 523, type: 'sine',      attack: 0.05, decay: 0.5,  sustain: 0.8, release: 1.0, vol: 0.8 },
  button_click: { freq: 1200,type: 'triangle',  attack: 0.001,decay: 0.04, sustain: 0.01,release: 0.05,vol: 0.3 },
  symbol_land:  { freq: 180, type: 'triangle',  attack: 0.001,decay: 0.06, sustain: 0.02,release: 0.08,vol: 0.25},
  letter_light: { freq: 880, type: 'sine',      attack: 0.01, decay: 0.1,  sustain: 0.1, release: 0.2, vol: 0.55},
  thunder_blast:{ freq: 55,  type: 'sawtooth',  attack: 0.001,decay: 0.6,  sustain: 0.1, release: 0.8, vol: 0.9 },
  buy_feature:  { freq: 659, type: 'sine',      attack: 0.02, decay: 0.3,  sustain: 0.4, release: 0.5, vol: 0.65},
  reconnect:    { freq: 392, type: 'triangle',  attack: 0.05, decay: 0.2,  sustain: 0.3, release: 0.3, vol: 0.4 },
};

// BGM definitions: array of notes [ {freq, dur, vol?} ] or oscillator config
const BGM_DEFINITIONS = {
  BGM_LOADING: {
    bpm: 60,
    notes: [196, 220, 247, 262, 220, 196, 175, 196],
    noteDur: 0.5,
    type: 'triangle',
    baseVol: 0.15,
    drone: 65.4,
    droneVol: 0.08,
  },
  BGM_LOBBY: {
    bpm: 80,
    notes: [262, 294, 330, 349, 392, 349, 330, 294],
    noteDur: 0.4,
    type: 'triangle',
    baseVol: 0.18,
    drone: 98,
    droneVol: 0.07,
  },
  BGM_MAIN: {
    bpm: 88,
    notes: [220, 247, 262, 294, 330, 294, 262, 247],
    noteDur: 0.35,
    type: 'sine',
    baseVol: 0.12,
    drone: 73.4,
    droneVol: 0.06,
    beat: { freq: 50, rate: 0.68, beatVol: 0.05 },
  },
  BGM_CASCADE: {
    bpm: 100,
    notes: [294, 330, 392, 440, 494, 440, 392, 330],
    noteDur: 0.3,
    type: 'sawtooth',
    baseVol: 0.1,
    drone: 82.4,
    droneVol: 0.05,
    beat: { freq: 60, rate: 0.6, beatVol: 0.07 },
  },
  BGM_THUNDER: {
    bpm: 110,
    notes: [330, 392, 440, 523, 587, 523, 440, 392],
    noteDur: 0.27,
    type: 'sawtooth',
    baseVol: 0.12,
    drone: 55,
    droneVol: 0.08,
    beat: { freq: 55, rate: 0.545, beatVol: 0.09 },
  },
  BGM_COIN_TOSS: {
    bpm: 90,
    notes: [294, 0, 330, 0, 349, 0, 392, 0],
    noteDur: 0.33,
    type: 'triangle',
    baseVol: 0.14,
    drone: 98,
    droneVol: 0.07,
    beat: { freq: 65, rate: 0.67, beatVol: 0.06 },
  },
  BGM_FREE_GAME: {
    bpm: 120,
    notes: [392, 440, 494, 523, 587, 659, 587, 523],
    noteDur: 0.25,
    type: 'sine',
    baseVol: 0.16,
    drone: 98,
    droneVol: 0.05,
    beat: { freq: 65, rate: 0.5, beatVol: 0.08 },
  },
  BGM_WIN: {
    bpm: 130,
    notes: [523, 587, 659, 698, 784, 880, 988, 1047],
    noteDur: 0.23,
    type: 'sine',
    baseVol: 0.18,
    drone: 130.8,
    droneVol: 0.06,
    beat: { freq: 80, rate: 0.46, beatVol: 0.06 },
  },
  BGM_77X: {
    bpm: 150,
    notes: [659, 740, 784, 880, 988, 1047, 988, 880],
    noteDur: 0.2,
    type: 'sawtooth',
    baseVol: 0.14,
    drone: 110,
    droneVol: 0.07,
    beat: { freq: 55, rate: 0.4, beatVol: 0.1 },
  },
};

// ============================================================
// AudioEngine Class
// ============================================================
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.masterVolume = 0.5;
    this.muted = false;
    this.unlocked = false;

    // BGM state
    this.currentBGMId = null;
    this.bgmOscillators = [];
    this.bgmDrone = null;
    this.bgmBeat = null;
    this.bgmGain = null;
    this.bgmNoteInterval = null;
    this.bgmNoteIndex = 0;

    // SFX pool
    this.sfxPool = [];
  }

  // ----------------------------------------------------------
  // Init / Unlock (iOS requires user gesture)
  // ----------------------------------------------------------
  async unlock() {
    if (this.unlocked) return true;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : this.masterVolume;
      this.masterGain.connect(this.ctx.destination);

      // Resume if suspended
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }

      // Play a silent buffer to fully unlock
      const buf = this.ctx.createBuffer(1, 1, 22050);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.ctx.destination);
      src.start(0);

      this.unlocked = true;
      console.log('[AudioEngine] Unlocked — Web Audio API ready');
      return true;
    } catch (err) {
      console.warn('[AudioEngine] Unlock failed:', err.message);
      return false;
    }
  }

  // ----------------------------------------------------------
  // Master Volume
  // ----------------------------------------------------------
  setVolume(vol) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && !this.muted) {
      this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.05);
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(
        this.muted ? 0 : this.masterVolume,
        this.ctx.currentTime,
        0.05
      );
    }
    return this.muted;
  }

  // ----------------------------------------------------------
  // Ensure context is running
  // ----------------------------------------------------------
  _ensureCtx() {
    if (!this.ctx) return false;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return true;
  }

  // ----------------------------------------------------------
  // SFX — single short sounds via ADSR envelope
  // ----------------------------------------------------------
  playSFX(sfxId, options = {}) {
    if (!this._ensureCtx()) return;
    const def = SFX_MAP[sfxId];
    if (!def) { console.warn('[AudioEngine] Unknown SFX:', sfxId); return; }

    const vol = (options.volume ?? 1.0) * def.vol * this.masterVolume;
    const now = this.ctx.currentTime;
    const freq = options.freq ?? def.freq;

    try {
      // Gain node with ADSR
      const gainNode = this.ctx.createGain();
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(vol, now + def.attack);
      gainNode.gain.linearRampToValueAtTime(vol * def.sustain, now + def.attack + def.decay);
      gainNode.gain.setValueAtTime(vol * def.sustain, now + def.attack + def.decay);
      gainNode.gain.linearRampToValueAtTime(0, now + def.attack + def.decay + def.release);
      gainNode.connect(this.masterGain);

      // Oscillator
      const osc = this.ctx.createOscillator();
      osc.type = def.type;
      osc.frequency.setValueAtTime(freq, now);

      // Frequency sweep for certain sounds
      if (sfxId === 'spin_start') {
        osc.frequency.linearRampToValueAtTime(freq * 0.5, now + 0.3);
      } else if (sfxId === 'cascade') {
        osc.frequency.exponentialRampToValueAtTime(freq * 2, now + 0.15);
      } else if (sfxId === 'thunder_blast') {
        osc.frequency.exponentialRampToValueAtTime(freq * 0.3, now + 0.5);
      } else if (sfxId === 'fg_enter') {
        osc.frequency.linearRampToValueAtTime(freq * 2, now + 0.8);
      }

      osc.connect(gainNode);
      osc.start(now);
      osc.stop(now + def.attack + def.decay + def.release + 0.05);

      // Optional: harmonics for richness
      if (['win_big', 'win_mega', 'fg_enter', 'coin_heads'].includes(sfxId)) {
        this._addHarmonic(freq * 2, def.type, vol * 0.3, now, def);
        this._addHarmonic(freq * 1.5, def.type, vol * 0.2, now, def);
      }
    } catch (err) {
      // Silently ignore audio errors (common on mobile)
    }
  }

  _addHarmonic(freq, type, vol, now, def) {
    try {
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(vol, now + def.attack * 1.5);
      g.gain.linearRampToValueAtTime(0, now + def.attack + def.decay + def.release * 0.7);
      g.connect(this.masterGain);
      const o = this.ctx.createOscillator();
      o.type = type === 'sawtooth' ? 'sine' : type;
      o.frequency.value = freq;
      o.connect(g);
      o.start(now);
      o.stop(now + def.attack + def.decay + def.release + 0.05);
    } catch (_) {}
  }

  // Convenience: play win sound based on tier
  playWinSound(tier) {
    const map = {
      'normal':      'win_small',
      'big-win':     'win_big',
      'mega-win':    'win_mega',
      'jackpot-win': 'win_mega',
      'max-win':     'win_mega',
    };
    this.playSFX(map[tier] || 'win_small');
  }

  // ----------------------------------------------------------
  // BGM — looping synthesized music
  // ----------------------------------------------------------
  playBGM(bgmId, options = {}) {
    if (!this._ensureCtx()) return;
    if (bgmId === this.currentBGMId && !options.force) return;

    const def = BGM_DEFINITIONS[bgmId];
    if (!def) { console.warn('[AudioEngine] Unknown BGM:', bgmId); return; }

    const fadeInTime = options.fadeIn ?? 0.8;

    this.stopBGM({ fadeOut: 0.3 });

    setTimeout(() => {
      if (!this._ensureCtx()) return;
      this.currentBGMId = bgmId;
      this._startBGM(def, fadeInTime);
    }, 350);
  }

  _startBGM(def, fadeInTime) {
    try {
      const now = this.ctx.currentTime;

      // BGM master gain
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.setValueAtTime(0, now);
      this.bgmGain.gain.linearRampToValueAtTime(def.baseVol * this.masterVolume, now + fadeInTime);
      this.bgmGain.connect(this.masterGain);

      // Drone oscillator (low continuous tone)
      if (def.drone) {
        this.bgmDrone = this.ctx.createOscillator();
        this.bgmDrone.type = 'sine';
        this.bgmDrone.frequency.value = def.drone;
        const droneGain = this.ctx.createGain();
        droneGain.gain.value = def.droneVol;
        this.bgmDrone.connect(droneGain);
        droneGain.connect(this.bgmGain);
        this.bgmDrone.start();
        this.bgmOscillators.push(this.bgmDrone);
      }

      // Beat oscillator (sub-bass pulse)
      if (def.beat) {
        this._startBeatLoop(def.beat, this.bgmGain);
      }

      // Melody note sequencer
      if (def.notes && def.notes.length) {
        this.bgmNoteIndex = 0;
        this._playNextNote(def);
      }
    } catch (err) {
      console.warn('[AudioEngine] BGM start error:', err.message);
    }
  }

  _playNextNote(def) {
    if (!this.bgmGain || !this._ensureCtx()) return;

    const notes = def.notes;
    const freq = notes[this.bgmNoteIndex % notes.length];
    this.bgmNoteIndex++;

    if (freq > 0) {
      try {
        const now = this.ctx.currentTime;
        const noteDur = def.noteDur;
        const osc = this.ctx.createOscillator();
        osc.type = def.type;
        osc.frequency.value = freq;

        const envGain = this.ctx.createGain();
        envGain.gain.setValueAtTime(0, now);
        envGain.gain.linearRampToValueAtTime(def.baseVol * 0.8, now + 0.02);
        envGain.gain.linearRampToValueAtTime(0, now + noteDur * 0.9);
        osc.connect(envGain);
        envGain.connect(this.bgmGain);
        osc.start(now);
        osc.stop(now + noteDur + 0.05);
      } catch (_) {}
    }

    const delay = (def.noteDur * 1000);
    this.bgmNoteInterval = setTimeout(() => this._playNextNote(def), delay);
  }

  _startBeatLoop(beatDef, gainNode) {
    const beatIntervalMs = beatDef.rate * 1000;
    const playBeat = () => {
      if (!this._ensureCtx() || !gainNode) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = beatDef.freq;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(beatDef.beatVol, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + beatDef.rate * 0.7);
        osc.connect(g);
        g.connect(gainNode);
        osc.start(now);
        osc.stop(now + beatDef.rate * 0.7);
      } catch (_) {}
    };
    playBeat();
    this.bgmBeatInterval = setInterval(playBeat, beatIntervalMs);
  }

  stopBGM(options = {}) {
    const fadeOutTime = options.fadeOut ?? 0.5;

    // Clear note sequencer
    if (this.bgmNoteInterval) {
      clearTimeout(this.bgmNoteInterval);
      this.bgmNoteInterval = null;
    }
    if (this.bgmBeatInterval) {
      clearInterval(this.bgmBeatInterval);
      this.bgmBeatInterval = null;
    }

    if (this.bgmGain && this.ctx) {
      try {
        const now = this.ctx.currentTime;
        this.bgmGain.gain.linearRampToValueAtTime(0, now + fadeOutTime);
      } catch (_) {}
    }

    // Stop all oscillators after fade
    const oscs = [...this.bgmOscillators];
    this.bgmOscillators = [];
    setTimeout(() => {
      oscs.forEach(o => { try { o.stop(); } catch (_) {} });
    }, fadeOutTime * 1000 + 100);

    this.bgmGain = null;
    this.bgmDrone = null;
    this.bgmBeat = null;
    this.currentBGMId = null;
  }

  // ----------------------------------------------------------
  // Screen → BGM binding
  // ----------------------------------------------------------
  bindToScreen(screenId) {
    const bgmId = AUDIO_MAP[screenId];
    if (bgmId && bgmId !== this.currentBGMId) {
      this.playBGM(bgmId, { fadeIn: 0.6 });
    }
  }

  // ----------------------------------------------------------
  // Composite sound sequences
  // ----------------------------------------------------------
  playSpinSequence(reelCount = 5) {
    this.playSFX('spin_start');
    for (let i = 0; i < reelCount; i++) {
      setTimeout(() => this.playSFX('reel_stop', { freq: 330 - i * 20 }), 300 + i * 250);
    }
  }

  playCascadeSequence(steps = 1) {
    for (let i = 0; i < steps; i++) {
      setTimeout(() => {
        this.playSFX('cascade', { freq: 440 + i * 55 });
        if (i > 0) this.playSFX('win_small');
      }, i * 600);
    }
  }

  playThunderBlessingSequence() {
    this.playSFX('thunder_blast');
    setTimeout(() => this.playSFX('lightning', { freq: 660 }), 150);
    setTimeout(() => this.playSFX('lightning', { freq: 880 }), 300);
    setTimeout(() => this.playSFX('win_big'), 500);
    setTimeout(() => this.playSFX('win_mega'), 900);
  }

  playFGEnterSequence() {
    this.playSFX('fg_enter');
    setTimeout(() => this.playSFX('letter_light', { freq: 880 }), 300);
    setTimeout(() => this.playSFX('letter_light', { freq: 988 }), 500);
    setTimeout(() => this.playSFX('letter_light', { freq: 1047 }), 700);
  }

  playCoinTossFlip() {
    this.playSFX('coin_toss');
    setTimeout(() => this.playSFX('coin_toss', { freq: 600 }), 150);
    setTimeout(() => this.playSFX('coin_toss', { freq: 800 }), 300);
  }

  playCoinResult(isHeads) {
    this.playSFX(isHeads ? 'coin_heads' : 'coin_tails');
    if (isHeads) {
      setTimeout(() => this.playSFX('letter_light'), 200);
    }
  }

  playLetterLight(letterIndex) {
    const freqs = [523, 587, 659, 698, 784];
    this.playSFX('letter_light', { freq: freqs[letterIndex] || 523 });
  }

  playButtonClick() {
    this.playSFX('button_click');
  }

  // ----------------------------------------------------------
  // Status
  // ----------------------------------------------------------
  getStatus() {
    return {
      unlocked: this.unlocked,
      contextState: this.ctx ? this.ctx.state : 'none',
      currentBGM: this.currentBGMId,
      muted: this.muted,
      volume: this.masterVolume,
    };
  }
}

// ============================================================
// Export
// ============================================================
window.AudioEngine = AudioEngine;
window.AUDIO_MAP = AUDIO_MAP;

console.log('[AudioEngine] Module loaded');
