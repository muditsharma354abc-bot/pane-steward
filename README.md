# Pane Steward

**Meta VR Start Developer Competition 2026 · Productivity · New Experience**

Chat AI that steers your spatial panes — a seated steward character opens up to **3** tabs, proposes the next step, and waits for **Keep** or **Undo**. Not a desk/plant clone.

**Live:** https://muditsharma354abc-bot.github.io/pane-steward/?demo=1

## What it does

1. Cold start with a character + chat + intent chips (**Prep call** / **Park this** / **What's next**)
2. Steward proposes a short plan (reason chip), then opens / focuses up to **3 spatial panes**
3. You **Keep** or **Undo** (Undo reverses the last tool batch)
4. Session strip tracks steward actions vs keeps

## Modes

| Mode | When | Behavior |
|------|------|----------|
| **Demo Steward** | No API key, offline, live timeout, or `?demo=1` | On-device rules; same panes + Keep/Undo — reel-safe |
| **Live chat** | User-supplied `?key=` (sessionStorage only; stripped from URL) | OpenAI-compatible `/v1/chat/completions` + tool calls; fail → Demo Steward |

**Awards framing:** Agentic primary — chat AI that drives your panes, with Demo Steward offline twin. Do **not** claim on-device-only for the live path.

**Privacy:** Chat goes to your chosen API host. Nothing stored on our server. Keys are never committed.

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
| `?demo=1` | Autoplay First Five hero loop (chat → ≤3 panes → Keep → Undo) |
| `?key=` | Store API key in `sessionStorage`, strip from URL — never commit |
| `?host=` | Optional OpenAI-compatible host |
| `?model=` | Optional model id |
| `?controllers=1` | Prefer controllers in IWER (hands are default) |

## Stack

- IWSDK `@iwsdk/core` **1.1.0-rc.2** + Vite + IWER emulator
- Procedural character (simple mesh + gesture stubs)
- Canvas spatial panes (max 3)
- Tools: `open_pane`, `close_pane`, `focus_pane`, `set_pane_text`, `propose_plan`, `complete_step`

## Build / Pages

```bash
npm run build
# push dist/ to gh-pages (VITE_BASE=/pane-steward/)
```

Live site is GitHub Pages from the `gh-pages` branch.

## Current gaps (honest)

First playable scaffold — thin vs full contest polish:

- World-space Keep/Undo rays (HUD twins only for now)
- Lip-sync, mic, a11y toggles not shipped yet
- Screenshots / capture assets not in repo yet

## Out of scope (v1)

Calendar sync, real email, multiplayer, desk/plant/furniture clones, eye-tracking, Meta sample forks.

## License

MIT — see `LICENSE`. Inter font: SIL OFL 1.1 (`public/fonts/inter/OFL.txt`).
