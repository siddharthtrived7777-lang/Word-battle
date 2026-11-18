class SoundEffects {
  private ctx: AudioContext | null = null;
  public enabled = true;

  private getCtx(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
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

  private playTone(freq: number, duration: number, type: OscillatorType = 'sine', gainVal = 0.06, delay = 0) {
    const ctx = this.getCtx();
    if (!ctx) return;
    try {
      const now = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(gainVal, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    } catch {
      // Ignore audio context errors when browser blocks autoplay
    }
  }

  turnChange() {
    this.playTone(523.25, 0.12, 'triangle', 0.06, 0);
    this.playTone(659.25, 0.16, 'triangle', 0.06, 0.09);
  }

  click() {
    this.playTone(440, 0.06, 'sine', 0.04, 0);
  }

  reveal() {
    this.playTone(392, 0.14, 'sine', 0.05, 0);
  }

  voteLocked() {
    this.playTone(587.33, 0.1, 'triangle', 0.06, 0);
  }

  winCrew() {
    this.playTone(523.25, 0.14, 'triangle', 0.07, 0);
    this.playTone(659.25, 0.14, 'triangle', 0.07, 0.1);
    this.playTone(783.99, 0.25, 'triangle', 0.08, 0.2);
  }

  winImposter() {
    this.playTone(311.13, 0.18, 'sawtooth', 0.04, 0);
    this.playTone(277.18, 0.28, 'sawtooth', 0.04, 0.15);
  }

  clapboard() {
    this.playTone(880, 0.05, 'square', 0.05, 0);
    this.playTone(622.25, 0.08, 'triangle', 0.06, 0.04);
  }

  wordComplete() {
    this.playTone(587.33, 0.1, 'triangle', 0.06, 0);
    this.playTone(880, 0.14, 'triangle', 0.06, 0.08);
  }

  wrongGuess() {
    this.playTone(220, 0.14, 'sawtooth', 0.04, 0);
    this.playTone(185, 0.2, 'sawtooth', 0.04, 0.11);
  }

  movieWin() {
    this.playTone(523.25, 0.12, 'triangle', 0.07, 0);
    this.playTone(659.25, 0.12, 'triangle', 0.07, 0.09);
    this.playTone(783.99, 0.14, 'triangle', 0.08, 0.18);
    this.playTone(1046.5, 0.32, 'triangle', 0.08, 0.28);
  }

  cardPlay() {
    this.playTone(320, 0.045, 'triangle', 0.05, 0);
    this.playTone(460, 0.05, 'sine', 0.04, 0.025);
  }

  cardFlip() {
    this.playTone(280, 0.04, 'sine', 0.04, 0);
    this.playTone(420, 0.045, 'triangle', 0.04, 0.02);
  }

  unoCall() {
    this.playTone(659.25, 0.09, 'triangle', 0.07, 0);
    this.playTone(880, 0.14, 'triangle', 0.07, 0.08);
  }

  cardWin() {
    this.playTone(523.25, 0.11, 'triangle', 0.06, 0);
    this.playTone(659.25, 0.11, 'triangle', 0.06, 0.08);
    this.playTone(783.99, 0.13, 'triangle', 0.07, 0.16);
    this.playTone(1046.5, 0.26, 'triangle', 0.07, 0.24);
  }
}

export const soundFx = new SoundEffects();
