/** Tool names the steward LLM (or Demo Steward) may call. */
export type ToolName =
  | 'open_pane'
  | 'close_pane'
  | 'focus_pane'
  | 'set_pane_text'
  | 'propose_plan'
  | 'complete_step';

export interface ToolCall {
  name: ToolName;
  args: Record<string, string>;
}

export interface ToolBatch {
  id: string;
  reason: string;
  speech: string;
  calls: ToolCall[];
  /** Snapshots of panes before this batch (for Undo). */
  before: PaneSnap[];
}

export interface PaneSnap {
  id: string;
  title: string;
  body: string;
  focused: boolean;
}

export const TOOL_DEFS = [
  {
    type: 'function' as const,
    function: {
      name: 'propose_plan',
      description: 'Speak a short plan and reason chip before acting.',
      parameters: {
        type: 'object',
        properties: {
          speech: { type: 'string' },
          reason: { type: 'string', description: 'One-line reason chip' },
        },
        required: ['speech', 'reason'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'open_pane',
      description: 'Open a spatial pane. Max 3 panes total.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['id', 'title'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'close_pane',
      description: 'Close a pane by id.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'focus_pane',
      description: 'Bring a pane forward.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'set_pane_text',
      description: 'Replace title and/or body of an open pane.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'complete_step',
      description: 'Mark the current step done; wait for Keep/Undo.',
      parameters: {
        type: 'object',
        properties: { summary: { type: 'string' } },
        required: ['summary'],
      },
    },
  },
];

export const SYSTEM_PROMPT = `You are Pane Steward, a seated productivity helper in XR.
Short replies. Always propose_plan first, then open/focus/set at most 3 panes, then complete_step.
Tools only — do not invent memory beyond this session. No medical or legal advice.
Prefer Brief / Now / Done pane ids when useful.`;
