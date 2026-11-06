export const IS_DEMO = new URLSearchParams(location.search).has('demo');

export interface SessionStats {
  did: number;
  kept: number;
}

const STATS_KEY = 'pane-steward.session.v1';
const A11Y_KEY = 'pane-steward.a11y.v1';

export interface A11yPrefs {
  /** High-contrast HUD + pane palette */
  highContrast: boolean;
  /** Text scale steps: 0=sm, 1=md (default), 2=lg */
  textScale: 0 | 1 | 2;
}

export function loadStats(): SessionStats {
  try {
    const raw = sessionStorage.getItem(STATS_KEY);
    if (raw) return JSON.parse(raw) as SessionStats;
  } catch { /* ignore */ }
  return { did: 0, kept: 0 };
}

export function saveStats(s: SessionStats): void {
  try { sessionStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export function loadA11y(): A11yPrefs {
  try {
    const raw = sessionStorage.getItem(A11Y_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<A11yPrefs>;
      const textScale = ([0, 1, 2] as const).includes(p.textScale as 0 | 1 | 2)
        ? (p.textScale as 0 | 1 | 2)
        : 1;
      return { highContrast: !!p.highContrast, textScale };
    }
  } catch { /* ignore */ }
  return { highContrast: false, textScale: 1 };
}

export function saveA11y(p: A11yPrefs): void {
  try { sessionStorage.setItem(A11Y_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}
