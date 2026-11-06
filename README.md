# Pane Steward

**Meta VR Start Developer Competition 2026 · Productivity · New Experience**

**Chatbot-only steward** (no character meshes / avatars / billboards). **Chat docks on the right**; **vertical pane tabs on the left** with content in the middle (≤3 tabs, easy add/remove). Chat AI (live) or **Demo Steward** (offline twin) opens / focuses / closes tabs. **Connectors tray:** Web (public URL fetch into a pane), Calendar / Mail / Notes (demo Connect stubs — **no OAuth**). Live **status line** narrates what is happening. **Keep all** / **Undo last** with focus dim on Keep.

**Live:** https://muditsharma354abc-bot.github.io/pane-steward/?demo=1  
**Live build:** commit `8162d09` · bundle `index-Crs9tMh1.js`


## Layout

| Region | Role |
|--------|------|
| **Left** | Vertical tab strip — select / × remove / + add (max 3) |
| **Middle** | Focused tab content |
| **Right** | Chat dock — speech, connectors, chips, Keep-all / Undo-last, input |
| **Top** | Mode chip + live status narration + Enter XR / a11y |

## Modes

| Mode | When | Behavior |
|------|------|----------|
| **Demo Steward** | No API key, offline, live timeout, or `?demo=1` | On-device rules; chat still drives tabs + demo connectors |
| **Live chat** | `?key=` in sessionStorage | OpenAI-compatible tools; fail → Demo Steward |

**Honesty:** No character meshes. Connect = session flag. Web = public pages / link pane only. Calendar/Mail/Notes = demo stubs — **not** real Gmail/Calendar OAuth. Do **not** claim Quest Browser RPA or account takeover.

## Eyes + hands

Shipped interaction (document only what is on camera / in IWER — **not** a blanket Meta “Designing for eyes and hands” compliance claim, and **not** Quest-proven):

- **Gaze** can highlight / select vertical tabs and connector chips
- **Long-hold** opens options (add / remove tab, Connect)
- **Pinch** is the primary action; every action also has an a11y / HUD **button twin** (Keep-all / Undo-last included)
- No fluff tooltips except critical

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

Prefer `clean-*.png` under `screens/` and `/workspace/meta-vr/screens/pane-steward/`:

| File | Shows |
|------|--------|
| `clean-cold-start.png` | Right chat dock + left tabs empty + Demo Steward banner + status |
| `clean-panes.png` | Vertical tabs + middle content from Prep call |
| `clean-keep.png` | Keep all pending |
| `clean-web.png` | Web Connect + Web pane |
| `clean-undo.png` | Undo last |
| `clean-demo-badge.png` | Offline twin chip |

## Current gaps

- Eyes + hands behaviors above are shipped for **IWER** local preview; **not yet tested on-device** (Quest headset).
- Calendar / Mail / Notes remain demo Connect stubs (no OAuth).
- Web Connect is public URL / fetch into a pane only — no account takeover / RPA.

## Out of scope (v1)

Character meshes, real Gmail/Calendar OAuth, Quest Browser automation, Meta sample forks, desk/plant furniture clones.

## License

MIT — see `LICENSE`. Inter font: SIL OFL 1.1.
