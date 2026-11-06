import type { ToolCall } from './tools.js';

export interface DemoPlan {
  speech: string;
  reason: string;
  calls: ToolCall[];
}

/** On-device rule twin — same panes + Keep/Undo, no LLM. */
export function demoPlan(intent: string, openIds: string[]): DemoPlan {
  const t = intent.toLowerCase().trim();
  if (/prep|call|meet/.test(t)) {
    return {
      speech: "I'll open Brief, Now, and Done for your call — skim Brief, then Keep.",
      reason: 'Prep call → 3 panes',
      calls: [
        { name: 'propose_plan', args: { speech: "I'll open Brief, Now, and Done for your call — skim Brief, then Keep.", reason: 'Prep call → 3 panes' } },
        { name: 'open_pane', args: { id: 'brief', title: 'Brief', body: 'Goal: align on Q4 scope.\nAttendees: you + 2.\nBring: one blocker.' } },
        { name: 'open_pane', args: { id: 'now', title: 'Now', body: '1. Open notes\n2. State goal in 20s\n3. Ask for decisions' } },
        { name: 'open_pane', args: { id: 'done', title: 'Done', body: 'Capture decisions here.\nPark leftovers after the call.' } },
        { name: 'focus_pane', args: { id: 'brief' } },
        { name: 'complete_step', args: { summary: 'Call prep — 3 panes ready' } },
      ],
    };
  }
  if (/park|later|hold/.test(t)) {
    const body = openIds.length
      ? `Parked from: ${openIds.join(', ')}\nRevisit after the next Keep.`
      : 'Inbox zero-ish.\nDrop one thought here and Keep.';
    return {
      speech: "Parking this on a Done shelf so it stops tugging at you.",
      reason: 'Park → Done shelf',
      calls: [
        { name: 'propose_plan', args: { speech: "Parking this on a Done shelf so it stops tugging at you.", reason: 'Park → Done shelf' } },
        { name: 'open_pane', args: { id: 'done', title: 'Done / Parked', body } },
        { name: 'focus_pane', args: { id: 'done' } },
        { name: 'complete_step', args: { summary: 'Item parked' } },
      ],
    };
  }
  if (/next|what|now|focus/.test(t)) {
    return {
      speech: "Next up: one focused step. I'll put it on Now.",
      reason: "What's next → single step",
      calls: [
        { name: 'propose_plan', args: { speech: "Next up: one focused step. I'll put it on Now.", reason: "What's next → single step" } },
        { name: 'open_pane', args: { id: 'now', title: 'Now', body: 'Write the first sentence of the draft.\nTimer: 10 min seated.' } },
        { name: 'set_pane_text', args: { id: 'now', title: 'Now', body: 'Write the first sentence of the draft.\nTimer: 10 min seated.\nWhen stuck → Park this.' } },
        { name: 'focus_pane', args: { id: 'now' } },
        { name: 'complete_step', args: { summary: 'Next step framed' } },
      ],
    };
  }
  // default
  return {
    speech: "I'll open a Brief pane so we have a place to start — Keep if it fits.",
    reason: 'Default → Brief pane',
    calls: [
      { name: 'propose_plan', args: { speech: "I'll open a Brief pane so we have a place to start — Keep if it fits.", reason: 'Default → Brief pane' } },
      { name: 'open_pane', args: { id: 'brief', title: 'Brief', body: `You said: ${intent.slice(0, 120) || 'get oriented'}\nPick Prep call, Park this, or What's next.` } },
      { name: 'focus_pane', args: { id: 'brief' } },
      { name: 'complete_step', args: { summary: 'Brief opened' } },
    ],
  };
}
