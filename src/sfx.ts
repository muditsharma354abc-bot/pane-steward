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
