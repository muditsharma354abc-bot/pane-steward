import { demoConnectorBody, extractUrl, type ConnectorState } from './connectors.js';
import type { ToolCall } from './tools.js';

export interface DemoPlan {
  speech: string;
  reason: string;
  calls: ToolCall[];
}

export interface DemoContext {
  connectors: ConnectorState;
}

/** On-device rule twin — chat intent drives panes + connectors; no LLM; no character meshes. */
export function demoPlan(intent: string, openIds: string[], ctx?: DemoContext): DemoPlan {
  const t = intent.toLowerCase().trim();
  const conn = ctx?.connectors ?? { web: false, calendar: false, mail: false, notes: false };
  const url = extractUrl(intent);

  // Web connector
  if (url || /\b(web|browse|lookup|look up|fetch|open site|wikipedia|http)\b/i.test(t)) {
    if (!conn.web) {
      return {
        speech: 'Connect Web in the tray first — then I can open a public page into a pane.',
        reason: 'Web · Connect needed',
        calls: [
          { name: 'propose_plan', args: { speech: 'Connect Web in the tray first — then I can open a public page into a pane.', reason: 'Web · Connect needed' } },
          { name: 'open_pane', args: { id: 'brief', title: 'Web · Connect', body: 'Tap Web · Connect in the connectors tray.\nPublic pages only — no account login / no Quest Browser RPA.\nThen send a URL or say “lookup …”.' } },
          { name: 'focus_pane', args: { id: 'brief' } },
          { name: 'complete_step', args: { summary: 'Web Connect required' } },
        ],
      };
    }
    const target = url || 'https://example.com';
    return {
      speech: `Opening ${target} into a Web pane — public summary only.`,
      reason: 'Chat → Web pane',
      calls: [
        { name: 'propose_plan', args: { speech: `Opening ${target} into a Web pane — public summary only.`, reason: 'Chat → Web pane' } },
        { name: 'open_web', args: { url: target, title: '' } },
        { name: 'complete_step', args: { summary: 'Web pane from chat' } },
      ],
    };
  }

  // Calendar / Mail / Notes
  if (/\b(calendar|schedule|meeting|agenda|standup)\b/i.test(t)) {
    if (!conn.calendar) {
      return {
        speech: 'Connect Calendar (demo) in the tray — no OAuth in this build.',
        reason: 'Calendar · Connect needed',
        calls: [
          { name: 'propose_plan', args: { speech: 'Connect Calendar (demo) in the tray — no OAuth in this build.', reason: 'Calendar · Connect needed' } },
          { name: 'open_pane', args: { id: 'brief', title: 'Calendar · Connect', body: 'Tap Calendar · Connect for the demo path.\nHonesty: session flag only — not your real calendar.' } },
          { name: 'focus_pane', args: { id: 'brief' } },
          { name: 'complete_step', args: { summary: 'Calendar Connect required' } },
        ],
      };
    }
    const d = demoConnectorBody('calendar', intent);
    return {
      speech: 'Opening a Calendar demo pane from your ask.',
      reason: 'Chat → Calendar demo',
      calls: [
        { name: 'propose_plan', args: { speech: 'Opening a Calendar demo pane from your ask.', reason: 'Chat → Calendar demo' } },
        { name: 'open_connector', args: { service: 'calendar', title: d.title, body: d.body } },
        { name: 'complete_step', args: { summary: 'Calendar demo pane' } },
      ],
    };
  }
  if (/\b(mail|email|inbox|gmail)\b/i.test(t)) {
    if (!conn.mail) {
      return {
        speech: 'Connect Mail (demo) in the tray — no Gmail OAuth in this build.',
        reason: 'Mail · Connect needed',
        calls: [
          { name: 'propose_plan', args: { speech: 'Connect Mail (demo) in the tray — no Gmail OAuth in this build.', reason: 'Mail · Connect needed' } },
          { name: 'open_pane', args: { id: 'brief', title: 'Mail · Connect', body: 'Tap Mail · Connect for the demo path.\nHonesty: no tokens — not your real inbox.' } },
          { name: 'focus_pane', args: { id: 'brief' } },
          { name: 'complete_step', args: { summary: 'Mail Connect required' } },
        ],
      };
    }
    const d = demoConnectorBody('mail', intent);
    return {
      speech: 'Opening a Mail demo pane from your ask.',
      reason: 'Chat → Mail demo',
      calls: [
        { name: 'propose_plan', args: { speech: 'Opening a Mail demo pane from your ask.', reason: 'Chat → Mail demo' } },
        { name: 'open_connector', args: { service: 'mail', title: d.title, body: d.body } },
        { name: 'complete_step', args: { summary: 'Mail demo pane' } },
      ],
    };
  }
  if (/\b(notes?|scratch|jot)\b/i.test(t)) {
    if (!conn.notes) {
      return {
        speech: 'Connect Notes (demo) in the tray first.',
        reason: 'Notes · Connect needed',
        calls: [
          { name: 'propose_plan', args: { speech: 'Connect Notes (demo) in the tray first.', reason: 'Notes · Connect needed' } },
          { name: 'open_pane', args: { id: 'brief', title: 'Notes · Connect', body: 'Tap Notes · Connect for the demo scratch pad.' } },
          { name: 'focus_pane', args: { id: 'brief' } },
          { name: 'complete_step', args: { summary: 'Notes Connect required' } },
        ],
      };
    }
    const d = demoConnectorBody('notes', intent);
    return {
      speech: 'Opening a Notes demo pane from your ask.',
      reason: 'Chat → Notes demo',
      calls: [
        { name: 'propose_plan', args: { speech: 'Opening a Notes demo pane from your ask.', reason: 'Chat → Notes demo' } },
        { name: 'open_connector', args: { service: 'notes', title: d.title, body: d.body } },
        { name: 'complete_step', args: { summary: 'Notes demo pane' } },
      ],
    };
  }

  if (/prep|call|meet/.test(t)) {
    return {
      speech: "Opening Brief, Now, and Done from your prep ask — skim Brief, then Keep all.",
      reason: 'Chat → Prep call → 3 panes',
      calls: [
        { name: 'propose_plan', args: { speech: "Opening Brief, Now, and Done from your prep ask — skim Brief, then Keep all.", reason: 'Chat → Prep call → 3 panes' } },
        { name: 'open_pane', args: { id: 'brief', title: 'Brief · Prep call', body: 'Goal: align on Q4 scope.\nAttendees: you + 2.\nBring: one blocker.' } },
        { name: 'open_pane', args: { id: 'now', title: 'Now · Prep call', body: '1. Open notes\n2. State goal in 20s\n3. Ask for decisions' } },
        { name: 'open_pane', args: { id: 'done', title: 'Done · Prep call', body: 'Capture decisions here.\nPark leftovers after the call.' } },
        { name: 'focus_pane', args: { id: 'brief' } },
        { name: 'complete_step', args: { summary: 'Call prep — 3 panes from chat' } },
      ],
    };
  }
  if (/park|later|hold/.test(t)) {
    const body = openIds.length
      ? `Parked from: ${openIds.join(', ')}\nRevisit after the next Keep all.`
      : 'Inbox zero-ish.\nDrop one thought here and Keep all.';
    return {
      speech: "Parking this on a Done shelf from your chat — so it stops tugging at you.",
      reason: 'Chat → Park → Done shelf',
      calls: [
        { name: 'propose_plan', args: { speech: "Parking this on a Done shelf from your chat — so it stops tugging at you.", reason: 'Chat → Park → Done shelf' } },
        { name: 'open_pane', args: { id: 'done', title: 'Done · Parked', body } },
        { name: 'focus_pane', args: { id: 'done' } },
        { name: 'complete_step', args: { summary: 'Item parked from chat' } },
      ],
    };
  }
  if (/next|what|now|focus/.test(t)) {
    return {
      speech: "Next up from your ask: one focused step on Now.",
      reason: "Chat → What's next → single step",
      calls: [
        { name: 'propose_plan', args: { speech: "Next up from your ask: one focused step on Now.", reason: "Chat → What's next → single step" } },
        { name: 'open_pane', args: { id: 'now', title: "Now · What's next", body: 'Write the first sentence of the draft.\nTimer: 10 min seated.' } },
        { name: 'set_pane_text', args: { id: 'now', title: "Now · What's next", body: 'Write the first sentence of the draft.\nTimer: 10 min seated.\nWhen stuck → Park this.' } },
        { name: 'focus_pane', args: { id: 'now' } },
        { name: 'complete_step', args: { summary: 'Next step framed from chat' } },
      ],
    };
  }
  const short = intent.trim().slice(0, 40) || 'get oriented';
  return {
    speech: "Opening a Brief pane from your chat so we have a place to start — Keep all if it fits.",
    reason: 'Chat → Brief pane',
    calls: [
      { name: 'propose_plan', args: { speech: "Opening a Brief pane from your chat so we have a place to start — Keep all if it fits.", reason: 'Chat → Brief pane' } },
      { name: 'open_pane', args: { id: 'brief', title: `Brief · ${short}`, body: `You said: ${intent.slice(0, 120) || 'get oriented'}\nPick Prep call, Park this, or What's next — or Connect Web.` } },
      { name: 'focus_pane', args: { id: 'brief' } },
      { name: 'complete_step', args: { summary: 'Brief opened from chat' } },
    ],
  };
}
