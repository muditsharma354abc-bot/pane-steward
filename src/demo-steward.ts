import type { ToolCall } from './tools.js';

export interface DemoPlan {
  speech: string;
  reason: string;
  calls: ToolCall[];
}

/** On-device rule twin — chat intent drives same panes + Keep/Undo, no LLM, no character meshes. */
export function demoPlan(intent: string, openIds: string[]): DemoPlan {
  const t = intent.toLowerCase().trim();
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
      { name: 'open_pane', args: { id: 'brief', title: `Brief · ${short}`, body: `You said: ${intent.slice(0, 120) || 'get oriented'}\nPick Prep call, Park this, or What's next.` } },
      { name: 'focus_pane', args: { id: 'brief' } },
      { name: 'complete_step', args: { summary: 'Brief opened from chat' } },
    ],
  };
}
