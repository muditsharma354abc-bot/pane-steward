import { SYSTEM_PROMPT, TOOL_DEFS, type ToolCall, type ToolName } from './tools.js';

const KEY_STORAGE = 'pane-steward.apiKey';
const HOST_STORAGE = 'pane-steward.apiHost';
const MODEL_STORAGE = 'pane-steward.model';
const DEFAULT_HOST = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4o-mini';
const TIMEOUT_MS = 8000;

export function captureKeyFromUrl(): void {
  const q = new URLSearchParams(location.search);
  const key = q.get('key');
  if (key) {
    sessionStorage.setItem(KEY_STORAGE, key);
    q.delete('key');
    const clean = `${location.pathname}${q.toString() ? `?${q}` : ''}${location.hash}`;
    history.replaceState(null, '', clean);
  }
  const host = q.get('host');
  if (host) sessionStorage.setItem(HOST_STORAGE, host);
  const model = q.get('model');
  if (model) sessionStorage.setItem(MODEL_STORAGE, model);
}

export function getApiKey(): string | null {
  return sessionStorage.getItem(KEY_STORAGE);
}

export function hasLiveKey(): boolean {
  return !!getApiKey() && navigator.onLine !== false;
}

export interface LlmResult {
  ok: boolean;
  speech: string;
  reason: string;
  calls: ToolCall[];
  error?: string;
  source: 'live' | 'timeout' | 'error' | 'offline' | 'nokey';
}

function parseToolCalls(raw: unknown): { speech: string; reason: string; calls: ToolCall[] } {
  const calls: ToolCall[] = [];
  let speech = '';
  let reason = '';
  const list = Array.isArray(raw) ? raw : [];
  for (const item of list) {
    const name = String(item?.function?.name ?? '') as ToolName;
    let args: Record<string, string> = {};
    try {
      const a = item?.function?.arguments;
      args = typeof a === 'string' ? JSON.parse(a) : (a ?? {});
    } catch { args = {}; }
    const normalized: Record<string, string> = {};
    for (const [k, v] of Object.entries(args)) normalized[k] = String(v ?? '');
    if (name === 'propose_plan') {
      speech = normalized.speech || speech;
      reason = normalized.reason || reason;
    }
    if (name) calls.push({ name, args: normalized });
  }
  return { speech, reason, calls };
}

export async function chatWithTools(userText: string, paneSummary: string): Promise<LlmResult> {
  const key = getApiKey();
  if (!key) return { ok: false, speech: '', reason: '', calls: [], source: 'nokey', error: 'No API key' };
  if (navigator.onLine === false) {
    return { ok: false, speech: '', reason: '', calls: [], source: 'offline', error: 'Offline' };
  }

  const host = (sessionStorage.getItem(HOST_STORAGE) || DEFAULT_HOST).replace(/\/$/, '');
  const model = sessionStorage.getItem(MODEL_STORAGE) || DEFAULT_MODEL;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${host}/chat/completions`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'system', content: `Open panes now: ${paneSummary || '(none)'}` },
          { role: 'user', content: userText },
        ],
        tools: TOOL_DEFS,
        tool_choice: 'auto',
      }),
    });
    clearTimeout(timer);
    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      return { ok: false, speech: '', reason: '', calls: [], source: 'error', error: err.slice(0, 200) };
    }
    const data = await res.json();
    const msg = data?.choices?.[0]?.message;
    const parsed = parseToolCalls(msg?.tool_calls ?? []);
    if (!parsed.speech && typeof msg?.content === 'string') parsed.speech = msg.content.slice(0, 220);
    if (!parsed.calls.length && !parsed.speech) {
      return { ok: false, speech: '', reason: '', calls: [], source: 'error', error: 'Empty model response' };
    }
    return { ok: true, ...parsed, source: 'live' };
  } catch (e) {
    clearTimeout(timer);
    const aborted = (e as Error)?.name === 'AbortError';
    return {
      ok: false, speech: '', reason: '', calls: [],
      source: aborted ? 'timeout' : 'error',
      error: aborted ? 'Timeout >8s' : String((e as Error)?.message ?? e),
    };
  }
}
