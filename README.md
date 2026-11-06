# Pane Steward

**Meta VR Start 2026 · Productivity · New Experience**

A seated steward you chat with — it opens your spatial tabs, does the next step, and waits for **Keep** or **Undo**.

## What it does

1. Cold start with a character + chat + intent chips (**Prep call** / **Park this** / **What's next**)
2. Steward proposes a short plan (reason chip), then opens / focuses up to **3 spatial panes**
3. You **👍 Keep** or **👎 Undo** (Undo reverses the last tool batch)
4. Session strip: “Steward did N · you kept M”

## Modes

| Mode | When | Behavior |
|------|------|----------|
| **Demo Steward** | No API key, offline, or live timeout &gt;8s | On-device rules; same panes + Keep/Undo |
| **Live chat** | `?key=` present (stored in `sessionStorage` only) | OpenAI-compatible `/v1/chat/completions` + tool calls |

HUD always shows: **Demo mode — add API key for live chat.** (or live chip when keyed)

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
| `?demo=1` | Autoplay First Five hero loop (intent → panes → Keep) |
| `?key=sk-…` | Store API key in `sessionStorage`, strip from URL |
| `?host=https://api.openai.com/v1` | Optional OpenAI-compatible host |
| `?model=gpt-4o-mini` | Optional model id |
| `?controllers=1` | Prefer controllers in IWER (hands are default) |

Example live:

```
http://localhost:8082/pane-steward/?key=YOUR_KEY
```

## Stack

- IWSDK `@iwsdk/core` **1.1.0-rc.2** + Vite + IWER emulator
- Procedural character (simple mesh + gesture stubs)
- Canvas spatial panes (max 3)
- Tools: `open_pane`, `close_pane`, `focus_pane`, `set_pane_text`, `propose_plan`, `complete_step`

## Build / Pages

```bash
npm run build
# dist/ → GitHub Pages (set VITE_BASE=/pane-steward/ or ./ )
```

Do not commit secrets. Prefer `?key=` at runtime.

## Out of scope (v1)

Calendar sync, real email, multiplayer, desk/plant/furniture clones, eye-tracking, Meta sample forks.

## License

MIT — see `LICENSE`. Inter font: SIL OFL 1.1 (`public/fonts/inter/OFL.txt`).
