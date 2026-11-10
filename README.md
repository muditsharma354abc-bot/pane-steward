# Pane Steward

**Meta VR Start Developer Competition 2026 · Productivity · New Experience**

**Demo Steward runs fully offline.** Cold start opens a Start card — **Demo Steward · offline, no API key** — then a 3-step guide (open a tab, Keep all, Undo last). The product works without any third-party AI service (the take-away test). **Chat AI is an optional live mode.**

**Chatbot-only steward** (no character meshes / avatars / billboards). **Chat docks on the right**; **vertical icon tabs on the left** (≤3, slide in/out) with a one-line title and subtitle (for example **Web** / example.com). Demo Steward or optional live Chat AI opens / focuses / closes tabs. One **Did N · Kept N** counter and a **status pill** in the dock header narrate what is happening. The connector note and intent row sit behind a **More** toggle. Chat placeholder: **Ask Steward…**. **Connectors tray:** Web (public URL fetch into a pane only); Calendar / Mail / Notes (demo stubs — **no OAuth**). **Keep all** / **Undo last**. A **Break** tab offers a 60-second offline brain break, then work tabs are restored.

**Live:** https://muditsharma354abc-bot.github.io/pane-steward/?demo=1  
**Live build (frozen):** commit `9efea44` · bundle `index-vtuOuXla.js`

![Start card: Demo Steward offline, no API key](screens/light-cold-start.png)

## Layout

| Region | Role |
|--------|------|
| **Left** | Vertical tab strip — one-line title + subtitle, select / × remove / + add (max 3, slide in/out, 228px rail) |
| **Middle** | Focused tab content |
| **Right** | Chat dock — mode chip + status pill + Did/Kept counter in the header, speech, connectors, More (note + intents), Break, Keep-all / Undo-last, Ask Steward… |
| **Top** | Enter XR / a11y (Contrast, A−/A+, Sound, Options) |

In the immersive IWER room the same layout is used: tabs on the left, panes in the centre, dock column on the right, with Keep / Undo lifted so they do not overlap the panes.

## Modes

| Mode | When | Behavior |
|------|------|----------|
| **Demo Steward** | No API key, offline, live timeout, or `?demo=1` | On-device rules; chat still drives tabs + demo connectors |
| **Live chat** | `?key=` in sessionStorage | OpenAI-compatible tools; fail → Demo Steward |

**Honesty:** No character meshes. Connect = session flag. Web = public pages / link pane only. Calendar/Mail/Notes = demo stubs — not real Gmail/Calendar OAuth. No Quest Browser RPA or account control.

## Light theme

Warm light theme (no pure white or black). Text contrast: body ink **14.2:1**, muted **8.9:1**. Accent text is **#9A3D14** (**6.5:1** on panels, **6.1:1** on the page). **#C45C26** is used for borders and glows only. **Contrast** and **A− / A+** controls are kept. Panels are rounded with soft shadows; world panes tilt toward the user just below eye level. The chat bar fits inside the dock; the mode chip and status pill sit in the dock header. The left rail is **228px** with full tab labels and aria-labels. Pane text is in a sans typeface.

**Sound:** a click on Keep and a reverse whoosh on Undo, with a Sound / Muted button twin.

## Break Quiz

Take a 60-second brain break, then Pane Steward puts your tabs back exactly where you left them. One **Break** tab in the dock; starting a break pauses the work tabs — they dim and show a high-contrast **Paused** tag, in 2D and in XR. A 60-second drain ring times the session and turns amber in the last 10 seconds.

Questions come from a bundled offline pack of **32** (date facts, science, and general knowledge). Date facts are source-checked for the judging window; see [`src/quiz-sources.md`](src/quiz-sources.md). Each question has 4 large answer targets with gaps, and each target has a button twin. Correct answers raise the level and build a streak.

Five one-use lifelines sit in a compact icon row — **Hint**, **Expert**, **50:50**, **Star**, and **Video Call a Friend** — and grey out when spent. The lifeline tile reads **Video Call a Friend**. It opens an icon-tile card labelled **Practice friend · offline pick** (simulated, offline, no real call). Expert advice and the friend pick come from the bundled pack, with no AI call. Wrong feedback and the friend result hold for about 2.5 seconds with the clock paused.

Answer feedback shows ✓ **Correct** or ✗ **Wrong**, not colour alone, plus a soft tone that follows Mute. The status line shows the full Undo and Back to work messages (including **Back to work: 3 tabs restored**). The end card un-dims the work tabs, shows that restored message, and offers a **Back to work** button, along with the score, level, best streak, and Did you know facts.

In immersive IWER the question uses larger type and wraps on a larger card (long questions wrap to 3 lines), with bigger timer and lifeline labels. XR tabs are **Brief / Now / Web**, matching 2D, and the lifelines sit in their own row.

## Eyes + hands

- **Pinch** is the primary action; every action also has a **button twin**.
- **Gaze highlight** on tabs and connector chips, and a **600 ms long-hold** Options popover, are shipped and verified on the 2D page, each with a button twin.
- In immersive IWER captures, a gaze glow is visible on **Keep all**, XR pinch-hold on **+Tab** opens Options, and pinch Keep works in XR. The XR Undo effect is not yet confirmed.
- This has not been tested on a Quest headset.

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
| `light-panes.png` | Title + subtitle tabs + middle content from Prep |
| `light-connectors.png` | Connectors tray on the right chat dock |
| `light-keep.png` | After Keep all |
| `light-undo.png` | Undo last |
| `light-gaze.png` | Gaze highlight on tabs and connector chips (2D) |
| `light-longhold.png` | 600 ms long-hold Options popover (2D) |
| `light-web.png` | Web Connect + Web pane |
| `light-xr-cold-start.png` | Immersive IWER view |
| `light-xr-panes.png` | Immersive IWER view |
| `light-xr-gaze.png` | XR gaze glow on Keep all |
| `light-xr-longhold.png` | XR pinch-hold on +Tab opens Options |
| `quiz-start.png` | Break Quiz start · 60-second brain break |
| `quiz-question.png` | Question, drain ring, and 4 answer targets |
| `quiz-lifelines.png` | Lifeline icon row (Hint, Expert, 50:50, Star, Video Call a Friend) |
| `quiz-friend.png` | Practice friend · offline pick |
| `quiz-feedback.png` | Correct feedback |
| `quiz-wrong.png` | Wrong feedback (✗ Wrong) |
| `quiz-amber.png` | Timer ring amber in the last 10 seconds |
| `quiz-end.png` | End card (test run), tabs restored |
| `quiz-xr-question.png` | Break Quiz in immersive IWER (Brief / Now / Web) |
| `quiz-xr-long.png` | Long question wraps to 3 lines, immersive IWER view |

## Current gaps

- Gaze highlight and the 600 ms long-hold Options popover are verified on the 2D page. In immersive IWER, gaze glow on Keep all, pinch-hold Options on +Tab, and pinch Keep are captured; the XR Undo effect is not yet confirmed. Not tested on a Quest headset.
- Calendar / Mail / Notes remain demo Connect stubs (no OAuth).
- Web Connect is public URL / fetch into a pane only — no account takeover or RPA.

## Out of scope (v1)

Character meshes, real Gmail/Calendar OAuth, Quest Browser automation, Meta sample forks, desk/plant furniture clones.

## License

MIT — see `LICENSE`. Inter font: SIL OFL 1.1.
