# Pane Steward

**Meta VR Start Developer Competition 2026 · Productivity · New Experience**

Chat AI that steers your **spatial panes** — the locked **hoodie duo** (male + female claymation-style helpers in charcoal hoodies, side-by-side billboards from `hoodie-duo.jpg`) chat, talk (browser `speechSynthesis` + bob), open up to **≤3 spatial panes**, propose the next step, and wait for **Keep** or **Undo**. No procedural / blocky / sphere / middle steward — duo only. Not a desk/plant clone. Content is chat-filled pane text — **not** real browser tabs, OAuth, or site/platform automation.

**Live:** https://muditsharma354abc-bot.github.io/pane-steward/?demo=1  
**Live build:** commit `a44b471` · bundle `index-83EEt4gB.js`

## What it does

1. Cold start with the hoodie duo + chat + intent chips (**Prep call** / **Park this** / **What's next**)
2. Steward proposes a short plan (reason chip), then opens / focuses up to **3 spatial panes** — duo point/open/nod on pane work
3. You **Keep** or **Undo** — HUD buttons **and** world-space twins (Undo reverses the last tool batch); duo gesture on Keep/Undo
4. Session strip tracks steward actions vs keeps

## Modes

| Mode | When | Behavior |
|------|------|----------|
| **Demo Steward** | No API key, offline, live timeout, or `?demo=1` | On-device rules; same panes + Keep/Undo — reel-safe |
| **Live chat** | User-supplied `?key=` (sessionStorage only; stripped from URL) | OpenAI-compatible `/v1/chat/completions` + tool calls (`open_pane` / `focus_pane` / `set_pane_text` / …); fail → Demo Steward |

**Awards framing:** Agentic primary — chat AI steers ≤3 spatial panes; Demo Steward offline twin. Do **not** claim on-device-only for the live path. Do **not** claim live website / platform control.

**Privacy:** Chat goes to your chosen API host. Nothing stored on our server. Keys are never committed.

## Accessibility

HUD a11y (persisted in `sessionStorage` key `pane-steward.a11y.v1`):

- **Contrast** — high-contrast mode for HUD, chips, speech, and canvas panes / Keep·Undo world twins
- **A− / A+** — three text-size steps on the HUD (`ts-0` / `ts-1` / `ts-2`)
- Primary controls (Keep, Undo, chips, Send, chat input, a11y buttons) are **≥48px** tall (`min-height` / `min-width`)
- Every XR gesture still has a HUD **button twin** (Keep / Undo)

## Quick start

```bash
npm install
npm run dev:runtime
# open http://localhost:8082/pane-steward/?demo=1
```

Or with the IWSDK CLI (IWER emulator + HTTPS helpers):

```bash
npm run dev
```

### Query flags

| Flag | Effect |
|------|--------|
| `?demo=1` | Autoplay hero loop: chat → Prep call opens ≤3 panes (Brief/Now/Done) → Keep → Park this → Undo (speech + world-space twins; no API key) |
| `?key=` | Store API key in `sessionStorage`, strip from URL — never commit |
| `?host=` | Optional OpenAI-compatible host |
| `?model=` | Optional model id |
| `?controllers=1` | Prefer controllers in IWER (hands are default) |

## Stack

- IWSDK `@iwsdk/core` **1.1.0-rc.2** + Vite + IWER emulator
- Locked hoodie duo: textured billboards from `public/characters/hoodie-duo.jpg` (male left + female right), talk bob + `speechSynthesis` on each reply, point/open/nod gestures on pane steer and Keep/Undo
- Canvas spatial panes (max 3)
- Tools: `open_pane`, `close_pane`, `focus_pane`, `set_pane_text`, `propose_plan`, `complete_step`

## Build / Pages

```bash
npm run build
# push dist/ to gh-pages (VITE_BASE=/pane-steward/)
```

Live site is GitHub Pages from the `gh-pages` branch.

## Screenshots

Contest frames under `/workspace/meta-vr/screens/pane-steward/` and mirrored in `screens/`. **Use `clean-*` only** (IWER gizmos/DevUI stripped):

| File | Shows |
|------|--------|
| **`clean-duo.png`** | **Primary character / cold-start shot** — hoodie male+female + Brief/Now/Done; no gizmos / no procedural steward (Contrast + A± visible in HUD) |
| `clean-panes.png` | Brief / Now / Done flow (pre-duo character — UX only) |
| `clean-keep.png` | Keep pending (HUD + world twin; pre-duo character — UX only) |
| `clean-undo.png` | Undo pending after Park (pre-duo character — UX only) |
| `clean-demo-badge.png` | Demo Steward mode chip (pre-duo character — UX only) |
| `clean-cold-start.png` | Older cold start + chips (**superseded for character** by `clean-duo.png`) |

Live tour: [Pages `?demo=1`](https://muditsharma354abc-bot.github.io/pane-steward/?demo=1). Re-capture clean XR: `node scripts/capture-clean.mjs` · duo: `node scripts/capture-duo.mjs`.

**Note:** For **character / cold-start**, use **`clean-duo.png` only**. Older `clean-*` frames remain useful for Keep/Undo/panes UX flow but show the **pre-duo character** (captured before `f6aa0e3`) — do not treat them as the live duo look.

## Current gaps (honest)

Demo tour Keep→Undo + world-space Keep/Undo twins are **shipped**. Hoodie duo (no procedural steward) is **shipped** (`f6aa0e3`). A11y Contrast + A−/A+ + ≥48px targets are **shipped** (`a44b471`). Clean duo XR screen is **in repo** (`clean-duo.png`). Still thin vs full contest polish:

- Lip-sync and mic not shipped yet
- Headset not yet tested on-device
- Clean XR screens (`clean-*.png`) hide IWER DevUI via `controlMode=programmatic`

## Out of scope (v1)

Calendar sync, real email, multiplayer, desk/plant/furniture clones, eye-tracking, Meta sample forks, real platform connectors, Quest Browser automation, iframes of Gmail/Calendar.

## License

MIT — see `LICENSE`. Inter font: SIL OFL 1.1 (`public/fonts/inter/OFL.txt`).
