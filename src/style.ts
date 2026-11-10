/** Mutable theme tokens — Object.assign in applyContrast so importers keep the same ref. */
export const C = {
  glass: '#ECE8E1',
  glassHi: '#FAF8F4',
  ink: '#2A2622',
  mute: '#4A453F',
  accent: '#C45C26',
  accentInk: '#9A3D14',
  pane: '#F4F1EC',
  keep: '#2A2622',
  undo: '#2A2622',
  bg: '#DED6CA',
  floor: '#C9C2B6',
  hemiSky: '#F3EDE3',
  hemiGround: '#B7AFA4',
};

const DEFAULT = { ...C };

/** High-contrast *light* variant — never pure #000 or #FFF. */
const HC = {
  glass: '#E4DDD2',
  glassHi: '#F7F3EA',
  ink: '#1A1612',
  mute: '#322C26',
  accent: '#9A3D14',
  accentInk: '#9A3D14',
  pane: '#EDE6D8',
  keep: '#1A1612',
  undo: '#1A1612',
  bg: '#D4CBBE',
  floor: '#B7AFA0',
  hemiSky: '#F0EADF',
  hemiGround: '#A89F92',
};

export const GLASS_ALPHA = 0.94;
export const FONT = 'Inter, system-ui, -apple-system, Segoe UI, sans-serif';

export function applyContrast(highContrast: boolean): void {
  Object.assign(C, highContrast ? HC : DEFAULT);
}

export async function loadFonts(): Promise<void> {
  const base = import.meta.env.BASE_URL;
  const faces: [string, string][] = [['Inter-Regular', '400 500'], ['Inter-SemiBold', '600'], ['Inter-Bold', '700 900']];
  try {
    const all = faces.map(([f, w]) => {
      const ff = new FontFace('Inter', `url(${base}fonts/inter/${f}.woff2) format("woff2")`, { weight: w });
      document.fonts.add(ff);
      return ff.load();
    });
    await Promise.race([Promise.all(all), new Promise((r) => setTimeout(r, 2000))]);
  } catch { /* system font fallback */ }
}
