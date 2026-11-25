// ============================================================
// TERRAVOX — Web Audio Procedural Sound & Ambient Music Engine
// ============================================================
window.TV = window.TV || {};

(function (TV) {
  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.masterGain = null;
      this.sfxGain = null;
      this.musicGain = null;
      this.masterVol = 0.8;
      this.sfxVol = 0.85;
      this.musicVol = 0.45;
      this.musicTimer = null;
      this.musicScale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25];
    }

    init() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();
        this.sfxGain.connect(this.masterGain);
        this.musicGain.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);
        this.applyVolumes();
        this.startAmbientMusic();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    }

    setVolumes(master, sfx, music) {
      this.masterVol = master;
      this.sfxVol = sfx;
      this.musicVol = music;
      this.applyVolumes();
    }

    applyVolumes() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this.masterGain.gain.setTargetAtTime(this.masterVol, t, 0.04);
      this.sfxGain.gain.setTargetAtTime(this.sfxVol, t, 0.04);
      this.musicGain.gain.setTargetAtTime(this.musicVol * 0.25, t, 0.08);
    }

    startAmbientMusic() {
      if (this.musicTimer) return;
      const playNote = () => {
        if (!this.ctx || this.ctx.state !== 'running' || this.musicVol <= 0.01 || this.masterVol <= 0.01) {
          this.musicTimer = setTimeout(playNote, 3200);
          return;
        }
        try {
          const now = this.ctx.currentTime;
          const root = this.musicScale[Math.floor(Math.random() * this.musicScale.length)];
          const osc = this.ctx.createOscillator();
          const osc2 = this.ctx.createOscillator();
          const filter = this.ctx.createBiquadFilter();
          const env = this.ctx.createGain();

          osc.type = 'sine';
          osc2.type = 'triangle';
          osc.frequency.setValueAtTime(root, now);
          osc2.frequency.setValueAtTime(root * 0.5, now);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(900, now);

          env.gain.setValueAtTime(0.0001, now);
          env.gain.linearRampToValueAtTime(0.18, now + 0.35);
          env.gain.exponentialRampToValueAtTime(0.0001, now + 3.8);

          osc.connect(filter);
          osc2.connect(filter);
          filter.connect(env);
          env.connect(this.musicGain);

          osc.start(now);
          osc2.start(now);
          osc.stop(now + 4.0);
          osc2.stop(now + 4.0);
        } catch (e) {}
        this.musicTimer = setTimeout(playNote, 2800 + Math.random() * 3500);
      };
      this.musicTimer = setTimeout(playNote, 1800);
    }

    playNoise(duration, freq, qVal, gainVal = 0.22, type = 'bandpass') {
      if (!this.ctx || !this.sfxGain) return;
      try {
        const bufferSize = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource();
        src.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = type;
        filter.frequency.value = freq;
        filter.Q.value = qVal;
        const gain = this.ctx.createGain();
        const now = this.ctx.currentTime;
        gain.gain.setValueAtTime(gainVal, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);
        src.start(now);
      } catch (e) {}
    }

    playTone(freqStart, freqEnd, duration, type = 'sine', gainVal = 0.2, delay = 0) {
      if (!this.ctx || !this.sfxGain) return;
      try {
        const now = this.ctx.currentTime + delay;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freqStart, now);
        if (freqEnd !== freqStart) {
          osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration);
        }
        gain.gain.setValueAtTime(gainVal, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + duration);
      } catch (e) {}
    }

    playDig(material = 'stone') {
      if (material === 'wood') {
        this.playNoise(0.07, 420 + Math.random() * 140, 2.2, 0.2);
        this.playTone(160 + Math.random() * 40, 110, 0.06, 'triangle', 0.14);
      } else if (material === 'dirt' || material === 'sand') {
        this.playNoise(0.08, 700 + Math.random() * 250, 1.2, 0.2);
      } else if (material === 'foliage') {
        this.playNoise(0.07, 1500 + Math.random() * 400, 1.0, 0.15);
      } else {
        this.playNoise(0.07, 900 + Math.random() * 300, 3.0, 0.2);
        this.playTone(280 + Math.random() * 60, 190, 0.05, 'square', 0.06);
      }
    }

    playBreak(material = 'stone') {
      if (material === 'glass') {
        this.playNoise(0.16, 3600, 1.5, 0.25, 'highpass');
        this.playTone(1850, 920, 0.12, 'triangle', 0.16);
      } else if (material === 'wood') {
        this.playNoise(0.15, 360, 1.4, 0.35);
        this.playTone(150, 75, 0.12, 'triangle', 0.22);
      } else if (material === 'foliage') {
        this.playNoise(0.14, 1400, 0.8, 0.24);
      } else {
        this.playNoise(0.18, 320 + Math.random() * 120, 0.9, 0.38);
        this.playTone(190, 65, 0.12, 'sawtooth', 0.12);
      }
    }

    playPlace(material = 'stone') {
      this.playNoise(0.06, material === 'wood' ? 480 : 620, 2.0, 0.22);
      this.playTone(material === 'wood' ? 180 : 140, 50, 0.08, 'sine', 0.25);
    }

    playFootstep(material = 'grass') {
      if (material === 'water') {
        this.playNoise(0.09, 900 + Math.random() * 400, 0.9, 0.14);
      } else if (material === 'sand' || material === 'snow') {
        this.playNoise(0.05, 1100 + Math.random() * 300, 1.4, 0.09);
      } else if (material === 'stone') {
        this.playNoise(0.04, 520 + Math.random() * 160, 2.8, 0.11);
      } else {
        this.playNoise(0.045, 390 + Math.random() * 120, 2.2, 0.1);
      }
    }

    playSplash() {
      this.playNoise(0.26, 650, 0.7, 0.28);
    }

    playHurt() {
      this.playTone(210, 68, 0.18, 'sawtooth', 0.3);
      this.playNoise(0.08, 300, 1.5, 0.15);
    }

    playPickup() {
      this.playTone(987, 987, 0.06, 'sine', 0.16, 0);
      this.playTone(1318, 1318, 0.1, 'sine', 0.16, 0.055);
    }

    playLevelUp() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
        this.playTone(f, f, 0.14, 'triangle', 0.16, idx * 0.07);
      });
    }

    playEat() {
      this.playNoise(0.07, 920 + Math.random() * 250, 2.6, 0.22);
      this.playTone(260, 180, 0.05, 'triangle', 0.08);
    }

    playDoor(open = true) {
      this.playTone(open ? 190 : 250, open ? 260 : 160, 0.12, 'triangle', 0.16);
      this.playNoise(0.06, 420, 2.5, 0.12);
    }

    playBow() {
      this.playTone(420, 140, 0.12, 'triangle', 0.18);
      this.playNoise(0.08, 1800, 1.5, 0.12);
    }

    playExplosion() {
      this.playNoise(0.65, 140, 0.5, 0.55, 'lowpass');
      this.playTone(110, 28, 0.55, 'sawtooth', 0.35);
    }

    playPig() {
      this.playTone(440, 610, 0.08, 'triangle', 0.18, 0);
      this.playTone(610, 360, 0.09, 'triangle', 0.18, 0.08);
    }
    playCow() {
      this.playTone(115, 72, 0.55, 'sawtooth', 0.18);
    }
    playSheep() {
      this.playTone(340, 290, 0.32, 'sawtooth', 0.14);
    }
    playChicken() {
      this.playTone(500, 650, 0.07, 'triangle', 0.15, 0);
      this.playTone(650, 440, 0.09, 'triangle', 0.15, 0.07);
    }
    playVillager() {
      this.playTone(220, 245, 0.18, 'triangle', 0.16);
    }
    playZombie() {
      this.playTone(95, 62, 0.48, 'sawtooth', 0.16);
    }
    playSkeleton() {
      this.playNoise(0.07, 2200, 3.5, 0.18);
      this.playTone(640, 320, 0.07, 'square', 0.08);
    }
    playSpider() {
      this.playNoise(0.14, 2800, 2.2, 0.16);
    }
    playFuse() {
      this.playNoise(0.4, 2400, 1.2, 0.22);
    }
  }

  TV.sounds = new SoundEngine();
})(window.TV);
