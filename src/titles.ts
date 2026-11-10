/** Split pane titles into a short heading + subtitle for one-line-each UI. */
export function paneCaption(title: string, id = ''): { heading: string; subtitle: string } {
  const raw = (title || '').trim();
  if (id === 'web' || /^web\s*·/i.test(raw)) {
    const rest = raw.replace(/^web\s*·\s*/i, '').trim();
    return { heading: 'Web', subtitle: rest || 'page' };
  }
  const i = raw.indexOf(' · ');
  if (i > 0) return { heading: raw.slice(0, i).trim(), subtitle: raw.slice(i + 3).trim() };
  return { heading: raw || 'Tab', subtitle: '' };
}
