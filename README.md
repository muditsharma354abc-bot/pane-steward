# Pane Steward

**Meta VR Start Developer Competition 2026 · Productivity · New Experience**

**Chat AI steers ≤3 spatial panes** — open / focus / close from chat intent, propose the next step, wait for **Keep all** or **Undo last**. **Demo Steward** is the offline twin (same panes + Keep/Undo, no LLM). Live **status line** narrates what is happening (`Opening Brief…`, `Focusing Now`, `Kept 2 · undid 1`). **No character meshes / no glTF avatars / no billboards.** Not a desk/plant clone. Content is chat-filled pane text — **not** real browser tabs, OAuth, or site/platform automation.

**Live:** https://muditsharma354abc-bot.github.io/pane-steward/?demo=1  
**Live build:** (see deploy note after push)

## What it does

1. Cold start with chat + intent chips (**Prep call** / **Park this** / **What's next**) + offline/live mode chip + status line
2. Chat proposes a short plan (reason chip), then opens / focuses up to **3 spatial panes** with titles from intent
3. You **Keep all** or **Undo last** — HUD buttons **and** world-space twins (Undo reverses pending batch or last Keep); focus dim on Keep
4. Session strip tracks steward actions vs keeps / undos

## Modes

| Mode | When | Behavior |
|------|------|----------|
| **Demo Steward** | No API key, offline, live timeout, or `?demo=1` | On-device rules; chat still drives panes + Keep/Undo — reel-safe offline twin |
| **Live chat** | User-supplied `?key=` (sessionStorage only; stripped from URL) | OpenAI-compatible `/v1/chat/completions` + tool calls; fail → Demo Steward |

**Awards framing:** Agentic primary — chat AI steers ≤3 spatial panes; Demo Steward offline twin. **No character meshes.** Do **not** claim on-device-only for the live path. Do **not** claim live website / platform control.

**Privacy:** Chat goes to your chosen API host. Nothing stored on our server. Keys are never committed.

## Accessibility

HUD a11y (persisted in `sessionStorage` key `pane-steward.a11y.v1`):

- **Contrast** — high-contrast mode for HUD, chips, speech, and canvas panes / Keep·Undo world twins
- **A− / A+** — three text-size steps on the HUD (`ts-0` / `ts-1` / `ts-2`)
- Primary controls (Keep all, Undo last, chips, Send, chat input, a11y buttons) are **≥48px** tall
- Every XR gesture still has a HUD **button twin** (Keep all / Undo last)

## Quick start

```bash
npm install
npm run dev:runtime
# open http://localhost:8082/pane-steward/?demo=1
```

### Query flags

| Flag | Effect |
|------|--------|
| `?demo=1` | Autoplay hero loop: chat → Prep call opens ≤3 panes → Keep all → Park this → Undo last |
| `?key=` | Store API key in `sessionStorage`, strip from URL — never commit |
| `?host=` | Optional OpenAI-compatible host |
| `?model=` | Optional model id |
| `?controllers=1` | Prefer controllers in IWER (hands are default) |

## Stack

- IWSDK `@iwsdk/core` **1.1.0-rc.2** + Vite + IWER emulator
- Canvas spatial panes (max 3) driven by chat tools — **no character meshes**
- Tools: `open_pane`, `close_pane`, `focus_pane`, `set_pane_text`, `propose_plan`, `complete_step`
- Productivity extras: pane titles from intent, Keep-all / Undo-last, focus dim on Keep, offline banner honesty, live status narration

## Build / Pages

```bash
npm run build
# push dist/ to gh-pages (VITE_BASE=/pane-steward/)
```

Live site is GitHub Pages from the `gh-pages` branch.

## Screenshots

Contest frames under `/workspace/meta-vr/screens/pane-steward/` and mirrored in `screens/`. Prefer **clean-*** (chat HUD + panes; no character meshes; IWER gizmos/DevUI stripped):

| File | Shows |
|------|--------|
| **`clean-cold-start.png`** | Cold start — chat + chips + Demo Steward offline banner + status line |
| **`clean-panes.png`** | Brief / Now / Done from chat (Prep call) |
| **`clean-keep.png`** | Keep all pending (HUD + world twin) |
| **`clean-undo.png`** | Undo last pending after Park |
| `clean-demo-badge.png` | Demo Steward mode chip |

Older `duo-*` / `clean-duo.png` frames showed a removed hoodie duo — **do not use** for judging; product is chat-first with **no character meshes**.

Live tour: [Pages `?demo=1`](https://muditsharma354abc-bot.github.io/pane-steward/?demo=1). Re-capture: `node scripts/capture-clean.mjs`.

## Current gaps (honest)

Chat-first panes + Keep-all / Undo-last + status line + a11y are **shipped**. Character meshes were **removed** by product lock. Still thin vs full contest polish:

- Lip-sync and mic not shipped
- Headset not yet tested on-device
- Clean XR screens (`clean-*.png`) hide IWER DevUI via `controlMode=programmatic`

## Out of scope (v1)

Character meshes / glTF avatars / billboards, calendar sync, real email, multiplayer, desk/plant/furniture clones, eye-tracking, Meta sample forks, real platform connectors, Quest Browser automation, iframes of Gmail/Calendar.

## License

MIT — see `LICENSE`. Inter font: SIL OFL 1.1 (`public/fonts/inter/OFL.txt`).
