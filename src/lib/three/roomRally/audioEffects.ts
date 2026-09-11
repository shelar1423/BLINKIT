/**
 * Web Audio sound generator for Room Rally
 * Synthesizes engine audio, collision bumps, pickup chimes, and finish celebration.
 */

class RoomRallyAudio {
  private ctx: AudioContext | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private isRunning = false;

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  startEngine() {
    const ctx = this.initCtx();
    if (!ctx || this.isRunning) return;

    try {
      this.engineOsc = ctx.createOscillator();
      this.engineGain = ctx.createGain();
      this.engineFilter = ctx.createBiquadFilter();

      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.setValueAtTime(55, ctx.currentTime); // Base idle rumble

      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.setValueAtTime(220, ctx.currentTime);

      this.engineGain.gain.setValueAtTime(0.08, ctx.currentTime);

      this.engineOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(ctx.destination);

      this.engineOsc.start();
      this.isRunning = true;
    } catch {
      // Audio autoplay policy fallback
    }
  }

  updateEngine(speedRatio: number) {
    if (!this.ctx || !this.engineOsc || !this.engineFilter || !this.isRunning) return;
    const now = this.ctx.currentTime;
    // Map speed (0..1) to engine frequency (55Hz -> 240Hz)
    const targetFreq = 55 + Math.min(Math.max(speedRatio, 0), 1.5) * 140;
    this.engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.05);

    // Open filter on high speed
    const cutoff = 220 + speedRatio * 500;
    this.engineFilter.frequency.setTargetAtTime(cutoff, now, 0.05);
  }

  stopEngine() {
    if (this.engineOsc) {
      try {
        this.engineOsc.stop();
        this.engineOsc.disconnect();
      } catch {}
      this.engineOsc = null;
    }
    this.isRunning = false;
  }

  /** Physical obstacle collision thud / bump */
  playCollision(intensity = 1) {
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140 * intensity, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.12);

      gain.gain.setValueAtTime(0.35 * Math.min(intensity, 1.2), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.16);
    } catch {}
  }

  /** Grocery pickup chime */
  playPickup(comboIndex = 0) {
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Pitch rises with combo
      const baseFreq = 587.33; // D5
      const semitoneShift = Math.min(comboIndex * 2, 8);
      const freq = baseFreq * Math.pow(2, semitoneShift / 12);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.14);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.23);
    } catch {}
  }

  /** Finish celebration fanfare */
  playFinish() {
    const ctx = this.initCtx();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      try {
        const now = ctx.currentTime + idx * 0.1;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.36);
      } catch {}
    });
  }
}

export const rallyAudio = new RoomRallyAudio();
