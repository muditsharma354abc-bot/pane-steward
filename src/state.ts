export const IS_DEMO = new URLSearchParams(location.search).has('demo');

export interface SessionStats {
  did: number;
  kept: number;
}

const STATS_KEY = 'pane-steward.session.v1';

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
