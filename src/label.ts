import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from '@iwsdk/core';
import { C, FONT, GLASS_ALPHA } from './style.js';

const PX = 1000;

export class Label {
  mesh: Mesh;
  private canvas = document.createElement('canvas');
  private tex: CanvasTexture;
  constructor(public w: number, public h: number) {
    this.canvas.width = Math.round(w * PX);
    this.canvas.height = Math.round(h * PX);
    this.tex = new CanvasTexture(this.canvas);
    this.tex.colorSpace = SRGBColorSpace;
    this.tex.anisotropy = 4;
    this.mesh = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ map: this.tex, transparent: true }));
  }
  draw(fn: (g: CanvasRenderingContext2D, W: number, H: number) => void): void {
    const g = this.canvas.getContext('2d')!;
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    fn(g, this.canvas.width, this.canvas.height);
    this.tex.needsUpdate = true;
  }
}

export function panel(g: CanvasRenderingContext2D, W: number, H: number, fill = C.glass, accent?: string): void {
  const m = Math.min(14, H * 0.08), r = Math.min(36, (H - 2 * m) / 2.8);
  const x = m, y = m * 0.7, w = W - 2 * m, h = H - 2 * m;
  g.save();
  g.shadowColor = 'rgba(42,38,34,0.22)';
  g.shadowBlur = m * 2.2;
  g.shadowOffsetY = m * 0.7;
  g.globalAlpha = GLASS_ALPHA;
  g.fillStyle = fill;
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fill();
  g.restore();
  // inner depth edge (warm, never pure white/black)
  const grad = g.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, 'rgba(250,248,244,0.55)');
  grad.addColorStop(1, 'rgba(42,38,34,0.08)');
  g.strokeStyle = grad;
  g.lineWidth = 3;
  g.beginPath();
  g.roundRect(x + 1.5, y + 1.5, w - 3, h - 3, r);
  g.stroke();
  if (accent) {
    g.fillStyle = accent;
    g.beginPath();
    g.roundRect(x, y, 12, h, [r, 0, 0, r]);
    g.fill();
    // selected-state glow
    g.save();
    g.shadowColor = accent;
    g.shadowBlur = 18;
    g.strokeStyle = accent;
    g.lineWidth = 3;
    g.beginPath();
    g.roundRect(x + 1, y + 1, w - 2, h - 2, r);
    g.stroke();
    g.restore();
  }
}

export function text(
  g: CanvasRenderingContext2D, s: string, x: number, y: number, size: number,
  color = C.ink, weight = 500, maxW = 9999, align: CanvasTextAlign = 'left',
): void {
  g.fillStyle = color; g.font = `${weight} ${size}px ${FONT}`; g.textAlign = align; g.textBaseline = 'middle';
  let t = s;
  while (g.measureText(t).width > maxW && t.length > 3) t = t.slice(0, -2);
  g.fillText(t === s ? s : `${t}…`, x, y);
}

export function para(
  g: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, maxW: number, color = C.ink,
): number {
  g.font = `400 ${size}px ${FONT}`; g.fillStyle = color; g.textAlign = 'left'; g.textBaseline = 'top';
  let line = '', yy = y;
  for (const w of s.split(/\s+/)) {
    if (g.measureText(`${line}${w} `).width > maxW && line) {
      g.fillText(line, x, yy); yy += size * 1.35; line = '';
    }
    line += `${w} `;
  }
  if (line.trim()) { g.fillText(line, x, yy); yy += size * 1.35; }
  return yy;
}
