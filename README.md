# Pane Steward

**Meta VR Start Developer Competition 2026 · Productivity · New Experience**

**Chatbot-only steward** (no character meshes / avatars / billboards). **Chat docks on the right**; **vertical pane tabs on the left** with content in the middle (≤3 tabs, easy add/remove). Chat AI (live) or **Demo Steward** (offline twin) opens / focuses / closes tabs. **Connectors tray:** Web (public URL fetch into a pane), Calendar / Mail / Notes (demo Connect stubs — **no OAuth**). Live **status line** narrates what is happening. **Keep all** / **Undo last** with focus dim on Keep.

**Live:** https://muditsharma354abc-bot.github.io/pane-steward/?demo=1  


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

Shipped interaction (document only what Judges scored as proven — **not** a blanket Meta “Designing for eyes and hands” compliance claim, and **not** Quest-proven):

- **Pinch** is the primary action; every action also has an a11y / HUD **button twin**
- **Gaze highlight** on tabs and connector chips: IWSDK `Hovered` (ray / head-gaze / canvas pointer) plus 2D `:hover` / `.gaze`
- **Long-hold (~600 ms)** pinch-hold or pointer-hold opens an Options popover (add/remove tab, Connect). Button twins included.
- Soft WebAudio click on Keep and reverse whoosh on Undo, with a Sound / Muted twin
- Default **light** theme (no pure white/black); Contrast is a high-contrast light variant

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

Prefer `light-*.png` under `screens/` and `/workspace/meta-vr/screens/pane-steward/`:

| File | Shows |
|------|--------|
| `light-cold-start.png` | Warm Start card · Demo Steward offline · no API key |
| `light-coldstart-guide.png` | 3-step guide after Start |
| `light-connectors.png` | Connectors tray on the right chat dock |
| `light-panes.png` | Vertical icon tabs + middle content from Prep |
| `light-keep.png` | Keep all pending |
| `light-web.png` | Web Connect + Web pane |
| `light-undo.png` | Undo last |
| `light-demo-badge.png` | Offline twin chip |
| `light-gaze.png` | Gaze highlight on a tab |
| `light-longhold.png` | Long-hold options popover |

## Current gaps

- Hands-first IWER preview is wired (pinch + poke + head-gaze simulation). Not claimed as on-device verified.
- Calendar / Mail / Notes remain demo Connect stubs (no OAuth).
- Web Connect is public URL / fetch into a pane only — no account takeover / RPA.

## Out of scope (v1)

Character meshes, real Gmail/Calendar OAuth, Quest Browser automation, Meta sample forks, desk/plant furniture clones.

## License

MIT — see `LICENSE`. Inter font: SIL OFL 1.1.
