/** Shared 2D gaze highlight + long-hold (pinch-hold / pointer-hold) helpers. */
export const HOLD_MS = 600;

export function bindGaze(el: HTMLElement, cls = 'gaze'): void {
  const on = () => el.classList.add(cls);
  const off = () => el.classList.remove(cls);
  el.addEventListener('pointerenter', on);
  el.addEventListener('pointerleave', off);
  el.addEventListener('focusin', on);
  el.addEventListener('focusout', off);
}

/**
 * Click vs ~600 ms hold. Used for tabs, connector chips, and any HUD twin
 * that should open the options popover on long-hold.
 * Gaze class is applied on pointer/focus hover (mouse + assistive pointers).
 */
export function bindGazeHold(
  el: HTMLElement,
  opts: {
    onClick?: (ev: Event) => void;
    onHold?: (ev: Event) => void;
  },
): void {
  bindGaze(el);
  if (!opts.onHold) {
    if (opts.onClick) el.addEventListener('click', (ev) => opts.onClick?.(ev));
    return;
  }

  let timer: ReturnType<typeof setTimeout> | 0 = 0;
  let held = false;

  const clear = (): void => {
    if (timer) clearTimeout(timer);
    timer = 0;
  };

  el.addEventListener('pointerdown', (ev) => {
    if (ev.button != null && ev.button !== 0) return;
    held = false;
    clear();
    timer = setTimeout(() => {
      held = true;
      timer = 0;
      opts.onHold?.(ev);
    }, HOLD_MS);
  });

  el.addEventListener('pointerup', (ev) => {
    const wasHeld = held;
    clear();
    if (!wasHeld) opts.onClick?.(ev);
    held = false;
  });

  el.addEventListener('pointercancel', () => {
    clear();
    held = false;
  });

  el.addEventListener('pointerleave', () => {
    // Leaving mid-hold cancels the hold so a drag-off does not fire options.
    if (!held) clear();
  });
}

export function tabIcon(id: string): string {
  if (id === 'brief') return '▣';
  if (id === 'now') return '▸';
  if (id === 'done') return '✓';
  if (id === 'web') return '◎';
  if (id === 'cal') return '▦';
  if (id === 'mail') return '✉';
  if (id === 'notes') return '✎';
  return '◇';
}
