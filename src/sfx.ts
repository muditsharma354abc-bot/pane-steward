/** WebAudio-synthesized feedback — no external sound assets. */
const MUTE_KEY = 'pane-steward.mute.v1';

let muted = false;
let ctx: AudioContext | null = null;

try {
  muted = sessionStorage.getItem(MUTE_KEY) === '1';
} catch { /* ignore */ }

function ac(): AudioContext | null {
  if (muted) return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean): void {
  muted = next;
  try { sessionStorage.setItem(MUTE_KEY, next ? '1' : '0'); } catch { /* ignore */ }
  if (next && ctx && ctx.state === 'running') void ctx.suspend();
}

export function toggleMuted(): boolean {
  setMuted(!muted);
  return muted;
}

/** Short click — used on Keep. */
export function sfxClick(): void {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(720, c.currentTime);
  o.frequency.exponentialRampToValueAtTime(380, c.currentTime + 0.07);
  g.gain.setValueAtTime(0.07, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.1);
  o.connect(g);
  g.connect(c.destination);
  o.start();
  o.stop(c.currentTime + 0.11);
}

/** Reverse whoosh — used on Undo. */
export function sfxWhoosh(): void {
  const c = ac();
  if (!c) return;
  const len = Math.floor(c.sampleRate * 0.3);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(2600, c.currentTime);
  f.frequency.exponentialRampToValueAtTime(240, c.currentTime + 0.28);
  const g = c.createGain();
  g.gain.setValueAtTime(0.045, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.3);
  src.connect(f);
  f.connect(g);
  g.connect(c.destination);
  src.start();
}

/** Soft rising pair of tones — correct answer (not a fanfare). */
export function sfxCorrect(): void {
  const c = ac();
  if (!c) return;
  const beep = (freq: number, at: number, dur: number): void => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, c.currentTime + at);
    g.gain.setValueAtTime(0.0001, c.currentTime + at);
    g.gain.exponentialRampToValueAtTime(0.045, c.currentTime + at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + at + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(c.currentTime + at);
    o.stop(c.currentTime + at + dur + 0.02);
  };
  beep(520, 0, 0.09);
  beep(660, 0.1, 0.1);
}

/** Soft low tap — wrong answer. */
export function sfxWrong(): void {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(196, c.currentTime);
  o.frequency.exponentialRampToValueAtTime(160, c.currentTime + 0.1);
  g.gain.setValueAtTime(0.04, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.12);
  o.connect(g);
  g.connect(c.destination);
  o.start();
  o.stop(c.currentTime + 0.13);
}
