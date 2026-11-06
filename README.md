# Pane Steward

**Meta VR Start Developer Competition 2026 · Productivity · New Experience**

Chat AI that steers your spatial panes — a seated steward character opens up to **3** tabs, proposes the next step, and waits for **Keep** or **Undo**. Not a desk/plant clone.

**Live:** https://muditsharma354abc-bot.github.io/pane-steward/?demo=1

## What it does

1. Cold start with a character + chat + intent chips (**Prep call** / **Park this** / **What's next**)
2. Steward proposes a short plan (reason chip), then opens / focuses up to **3 spatial panes**
3. You **Keep** or **Undo** — HUD buttons **and** world-space twins (Undo reverses the last tool batch)
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
| `?demo=1` | Autoplay hero loop: chat → Prep call opens ≤3 panes (Brief/Now/Done) → Keep → Park this → Undo (speech + world-space twins; no API key) |
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

## Screenshots

Contest frames under `/workspace/meta-vr/screens/pane-steward/` and mirrored in `screens/`. **Use `clean-*` only** (IWER gizmos/DevUI stripped):

| File | Shows |
|------|--------|
| `clean-cold-start.png` | Cold start + intent chips |
| `clean-panes.png` | Brief / Now / Done |
| `clean-keep.png` | Keep pending (HUD + world twin) |
| `clean-undo.png` | Undo pending after Park |
| `clean-demo-badge.png` | Demo Steward mode chip |

Live tour: [Pages `?demo=1`](https://muditsharma354abc-bot.github.io/pane-steward/?demo=1). Re-capture clean XR: `node scripts/capture-clean.mjs`.

## Current gaps (honest)

Demo tour Keep→Undo + world-space Keep/Undo twins are **shipped** (d346796). Still thin vs full contest polish:

- Lip-sync, mic, a11y toggles not shipped yet
- Headset not yet tested on-device
- Clean XR screens (`clean-*.png`) hide IWER DevUI via `controlMode=programmatic`

## Out of scope (v1)

Calendar sync, real email, multiplayer, desk/plant/furniture clones, eye-tracking, Meta sample forks.

## License

MIT — see `LICENSE`. Inter font: SIL OFL 1.1 (`public/fonts/inter/OFL.txt`).
