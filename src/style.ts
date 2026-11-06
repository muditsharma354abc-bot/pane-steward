export const C = {
  glass: '#14161C', glassHi: '#262A34',
  ink: '#F2F4F8', mute: '#A7AFBD', accent: '#7C9CFF', warm: '#FFD27A',
  keep: '#5AD67A', undo: '#FF8A5B', pane: '#1B2233',
};
export const GLASS_ALPHA = 0.82;
export const FONT = 'Inter, system-ui, -apple-system, Segoe UI, sans-serif';

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
