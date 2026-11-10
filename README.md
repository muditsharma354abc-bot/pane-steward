# Pane Steward

**Meta VR Start Developer Competition 2026 · Productivity · New Experience**

**Demo Steward runs fully offline.** Cold start opens a Start card — **Demo Steward · offline, no API key** — then a 3-step guide (open a tab, Keep all, Undo last). The product works without any third-party AI service (the take-away test). **Chat AI is an optional live mode.**

**Chatbot-only steward** (no character meshes / avatars / billboards). **Chat docks on the right**; **vertical icon tabs on the left** (≤3, slide in/out) with content in the middle. Demo Steward or optional live Chat AI opens / focuses / closes tabs. A live **status pill** in the dock header narrates what is happening. **Connectors tray:** Web (public URL fetch into a pane only); Calendar / Mail / Notes (demo stubs — **no OAuth**). **Keep all** / **Undo last**.

**Live:** https://muditsharma354abc-bot.github.io/pane-steward/?demo=1  
**Live build:** commit `52da364` · bundle `index-kIrzp-lN.js`

![Start card: Demo Steward offline, no API key](screens/light-cold-start.png)

## Layout

| Region | Role |
|--------|------|
| **Left** | Vertical tab strip — select / × remove / + add (max 3, slide in/out, full labels on a 228px rail) |
| **Middle** | Focused tab content |
| **Right** | Chat dock — mode chip + status pill in the header, speech, connectors, chips, Keep-all / Undo-last, input |
| **Top** | Enter XR / a11y (Contrast, A−/A+, Sound, Options) |

## Modes

| Mode | When | Behavior |
|------|------|----------|
| **Demo Steward** | No API key, offline, live timeout, or `?demo=1` | On-device rules; chat still drives tabs + demo connectors |
| **Live chat** | `?key=` in sessionStorage | OpenAI-compatible tools; fail → Demo Steward |

**Honesty:** No character meshes. Connect = session flag. Web = public pages / link pane only. Calendar/Mail/Notes = demo stubs — not real Gmail/Calendar OAuth. No Quest Browser RPA or account control.

## Light theme

Warm light theme (no pure white or black). Text contrast: body ink **14.2:1**, muted **8.9:1**. Accent text is **#9A3D14** (**6.5:1** on panels, **6.1:1** on the page). **#C45C26** is used for borders and glows only. **Contrast** and **A− / A+** controls are kept. Panels are rounded with soft shadows; world panes tilt toward the user just below eye level. The chat bar fits inside the dock; the mode chip and status pill sit in the dock header. The left rail is **228px** with full tab labels and aria-labels. Pane text is in a sans typeface.

**Sound:** a click on Keep and a reverse whoosh on Undo, with a Sound / Muted button twin.

## Eyes + hands

- **Pinch** is the primary action; every action also has a **button twin**.
- **Gaze highlight** on tabs and connector chips, and a **600 ms long-hold** Options popover, are shipped and verified on the 2D page only, each with a button twin.
- Panes render in light mode inside the IWER immersive room. XR layout, XR hover, and XR pinch-hold are a follow-up and are not verified.

## Accessibility

Contrast + A−/A+ + ≥48px targets; HUD button twins for Keep-all / Undo-last and other primary actions (see Eyes + hands).

## Quick start

```bash
npm install
npm run dev:runtime
# open http://localhost:8082/pane-steward/?demo=1
```

## Stack

- IWSDK `@iwsdk/core` **1.1.0-rc.2** + Vite + IWER
- Canvas world panes for XR + HTML left tabs / middle stage / right chat dock
- Tools: `open_pane`, `open_web`, `open_connector`, `close_pane`, `focus_pane`, `set_pane_text`, `propose_plan`, `complete_step`

## Screenshots

| File | Shows |
|------|--------|
| `light-cold-start.png` | Start card · Demo Steward offline, no API key |
| `light-coldstart-guide.png` | 3-step guide after Start (open a tab, Keep all, Undo last) |
| `light-panes.png` | Vertical icon tabs + middle content from Prep |
| `light-connectors.png` | Connectors tray on the right chat dock |
| `light-keep.png` | After Keep all |
| `light-undo.png` | Undo last |
| `light-gaze.png` | Gaze highlight on tabs and connector chips (2D) |
| `light-longhold.png` | 600 ms long-hold Options popover (2D) |
| `light-web.png` | Web Connect + Web pane |
| `light-xr-cold-start.png` | Immersive IWER view (XR layout fix pending) |

## Current gaps

- Gaze highlight and the 600 ms long-hold Options popover are verified on the 2D page only. Panes render in light mode inside the IWER immersive room; XR layout, XR hover, and XR pinch-hold are a follow-up and are not verified.
- Calendar / Mail / Notes remain demo Connect stubs (no OAuth).
- Web Connect is public URL / fetch into a pane only — no account takeover or RPA.

## Out of scope (v1)

Character meshes, real Gmail/Calendar OAuth, Quest Browser automation, Meta sample forks, desk/plant furniture clones.

## License

MIT — see `LICENSE`. Inter font: SIL OFL 1.1.
