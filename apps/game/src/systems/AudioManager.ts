import { save } from './SaveManager';

type SfxName =
  | 'jump'
  | 'coin'
  | 'gem'
  | 'stomp'
  | 'hurt'
  | 'die'
  | 'spring'
  | 'power'
  | 'checkpoint'
  | 'goal'
  | 'select'
  | 'block';

interface Tone {
  freq: number;
  to?: number;
  dur: number;
  type: OscillatorType;
  gain: number;
  delay?: number;
}

const SFX: Record<SfxName, Tone[]> = {
  jump: [{ freq: 380, to: 720, dur: 0.14, type: 'square', gain: 0.18 }],
  coin: [
    { freq: 988, dur: 0.05, type: 'square', gain: 0.16 },
    { freq: 1319, dur: 0.12, type: 'square', gain: 0.16, delay: 0.05 },
  ],
  gem: [
    { freq: 784, dur: 0.08, type: 'triangle', gain: 0.2 },
    { freq: 1047, dur: 0.08, type: 'triangle', gain: 0.2, delay: 0.08 },
    { freq: 1568, dur: 0.18, type: 'triangle', gain: 0.2, delay: 0.16 },
  ],
  stomp: [{ freq: 220, to: 80, dur: 0.12, type: 'square', gain: 0.2 }],
  hurt: [{ freq: 320, to: 120, dur: 0.28, type: 'sawtooth', gain: 0.2 }],
  die: [
    { freq: 523, dur: 0.1, type: 'square', gain: 0.22 },
    { freq: 392, dur: 0.1, type: 'square', gain: 0.22, delay: 0.1 },
    { freq: 262, dur: 0.35, type: 'square', gain: 0.22, delay: 0.2 },
  ],
  spring: [{ freq: 300, to: 1200, dur: 0.22, type: 'sine', gain: 0.2 }],
  power: [
    { freq: 523, dur: 0.07, type: 'square', gain: 0.2 },
    { freq: 659, dur: 0.07, type: 'square', gain: 0.2, delay: 0.07 },
    { freq: 784, dur: 0.07, type: 'square', gain: 0.2, delay: 0.14 },
    { freq: 1047, dur: 0.16, type: 'square', gain: 0.2, delay: 0.21 },
  ],
  checkpoint: [
    { freq: 659, dur: 0.09, type: 'triangle', gain: 0.2 },
    { freq: 988, dur: 0.16, type: 'triangle', gain: 0.2, delay: 0.09 },
  ],
  goal: [
    { freq: 523, dur: 0.12, type: 'square', gain: 0.22 },
    { freq: 659, dur: 0.12, type: 'square', gain: 0.22, delay: 0.12 },
    { freq: 784, dur: 0.12, type: 'square', gain: 0.22, delay: 0.24 },
    { freq: 1047, dur: 0.3, type: 'square', gain: 0.22, delay: 0.36 },
  ],
  select: [{ freq: 660, dur: 0.05, type: 'square', gain: 0.12 }],
  block: [{ freq: 160, to: 90, dur: 0.09, type: 'square', gain: 0.16 }],
};

/**
 * Audio 100% procedural (chiptune con WebAudio).
 * No requiere archivos de sonido: el juego suena desde el minuto 1.
 * Si mas adelante agregas .ogg/.mp3, puedes cambiar esta clase por
 * el loader de Phaser sin tocar el resto del codigo.
 */
class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = save.settings.sfxVolume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  setVolume(v: number): void {
    if (this.master) this.master.gain.value = v;
  }

  play(name: SfxName): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;

    for (const tone of SFX[name]) {
      const start = ctx.currentTime + (tone.delay ?? 0);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = tone.type;
      osc.frequency.setValueAtTime(tone.freq, start);
      if (tone.to) osc.frequency.exponentialRampToValueAtTime(tone.to, start + tone.dur);
      gain.gain.setValueAtTime(tone.gain, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(start);
      osc.stop(start + tone.dur + 0.02);
    }
  }
}

export const audio = new AudioManager();
