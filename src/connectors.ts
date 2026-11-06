/** Safe v1 connectors — session flags only; no OAuth secrets in the Pages build. */

export type ConnectorId = 'web' | 'calendar' | 'mail' | 'notes';

const KEY = 'pane-steward.connectors.v1';

export type ConnectorState = Record<ConnectorId, boolean>;

const DEFAULT: ConnectorState = { web: false, calendar: false, mail: false, notes: false };

export function loadConnectors(): ConnectorState {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<ConnectorState>;
      return {
        web: !!p.web,
        calendar: !!p.calendar,
        mail: !!p.mail,
        notes: !!p.notes,
      };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT };
}

export function saveConnectors(s: ConnectorState): void {
  try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export function isConnected(id: ConnectorId, s = loadConnectors()): boolean {
  return !!s[id];
}

/** Extract first http(s) URL from free text, or undefined. */
export function extractUrl(text: string): string | undefined {
  const m = text.match(/https?:\/\/[^\s<>"')\]]+/i);
  if (m) return m[0].replace(/[.,;:!?)]+$/, '');
  // bare domain → https
  const d = text.match(/\b((?:[a-z0-9-]+\.)+(?:com|org|net|io|dev|ai|co|app|edu|gov)(?:\/[^\s]*)?)/i);
  if (d) return `https://${d[1]}`;
  return undefined;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface WebFetchResult {
  ok: boolean;
  url: string;
  title: string;
  body: string;
  source: 'direct' | 'reader' | 'link-only' | 'demo' | 'error';
  error?: string;
}

/**
 * Public Web fetch for spatial panes.
 * Tries direct fetch, then a public text reader mirror. Never claims Quest Browser RPA.
 * Truncates for pane readability. Always includes the source URL in the body.
 */
export async function fetchPublicWeb(url: string, opts?: { demo?: boolean }): Promise<WebFetchResult> {
  let normalized = url.trim();
  if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;
  let host = normalized;
  try { host = new URL(normalized).hostname; } catch { /* keep */ }

  if (opts?.demo || navigator.onLine === false) {
    return {
      ok: true,
      url: normalized,
      title: `Web · ${host}`,
      body:
        `Demo / offline twin summary for ${host}\n` +
        `• Public page sketch (not live account data)\n` +
        `• Link: ${normalized}\n` +
        `Honesty: Demo Steward simulated this — not Quest Browser automation.`,
      source: 'demo',
    };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 7000);
  try {
    // 1) Direct public fetch (works for CORS-open sites)
    try {
      const res = await fetch(normalized, { signal: ctrl.signal, mode: 'cors' });
      if (res.ok) {
        const ct = res.headers.get('content-type') || '';
        const raw = await res.text();
        const text = ct.includes('html') ? stripHtml(raw) : raw;
        const snippet = text.slice(0, 720);
        return {
          ok: true,
          url: normalized,
          title: `Web · ${host}`,
          body: `${snippet}${text.length > 720 ? '…' : ''}\n\nLink: ${normalized}\nHonesty: public fetch into a pane — not account takeover / not Quest RPA.`,
          source: 'direct',
        };
      }
    } catch { /* try reader */ }

    // 2) Public text reader mirror (CORS-friendly plain text for many public URLs)
    try {
      const readerUrl = `https://r.jina.ai/${normalized}`;
      const res = await fetch(readerUrl, { signal: ctrl.signal, mode: 'cors' });
      if (res.ok) {
        const text = (await res.text()).slice(0, 720);
        return {
          ok: true,
          url: normalized,
          title: `Web · ${host}`,
          body: `${text}${text.length >= 720 ? '…' : ''}\n\nLink: ${normalized}\nHonesty: public reader summary in a pane — not Quest Browser automation.`,
          source: 'reader',
        };
      }
    } catch { /* fall through */ }

    return {
      ok: true,
      url: normalized,
      title: `Web · ${host}`,
      body:
        `Could not inline public text (CORS / network).\n` +
        `Open in Quest Browser: ${normalized}\n` +
        `Honesty: Pane Steward does not automate Quest Browser or log into sites.`,
      source: 'link-only',
    };
  } catch (e) {
    return {
      ok: false,
      url: normalized,
      title: `Web · ${host}`,
      body: `Fetch failed.\nLink: ${normalized}\nHonesty: no real browser automation.`,
      source: 'error',
      error: String((e as Error)?.message || e),
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Demo connector pane bodies (Calendar / Mail / Notes) — never real account data. */
export function demoConnectorBody(service: Exclude<ConnectorId, 'web'>, intent: string): { title: string; body: string; id: string } {
  if (service === 'calendar') {
    return {
      id: 'cal',
      title: 'Calendar · demo',
      body:
        `Demo Connect path (no OAuth).\n` +
        `Next: Standup · today 10:00\n` +
        `Then: Focus block · 14:00\n` +
        `Ask: ${intent.slice(0, 80) || 'today'}\n` +
        `Honesty: not your real calendar — Connect is a session flag until a safe keyed backend.`,
    };
  }
  if (service === 'mail') {
    return {
      id: 'mail',
      title: 'Mail · demo',
      body:
        `Demo Connect path (no Gmail OAuth).\n` +
        `Inbox sketch:\n• Alex — Q4 notes (skim)\n• Sam — parking lot items\n` +
        `Ask: ${intent.slice(0, 80) || 'inbox'}\n` +
        `Honesty: not your real mail — no tokens in this Pages build.`,
    };
  }
  return {
    id: 'notes',
    title: 'Notes · demo',
    body:
      `Demo Connect path.\n` +
      `Scratch:\n• ${intent.slice(0, 100) || 'capture one thought'}\n• Park leftovers after Keep all\n` +
      `Honesty: local demo notes only — not a cloud notes account.`,
  };
}
