#!/usr/bin/env node
/** WCAG contrast check for the light + HC light palettes. */
function lum(hex) {
  const n = parseInt(hex.slice(1), 16);
  const to = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * to((n >> 16) & 255) + 0.7152 * to((n >> 8) & 255) + 0.0722 * to(n & 255);
}
function contrast(a, b) {
  const L1 = lum(a), L2 = lum(b);
  const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}

const pairs = [
  ['body ink / panel', '#2A2622', '#FAF8F4', 4.5],
  ['body ink / page', '#2A2622', '#F4F1EC', 4.5],
  ['body ink / glass', '#2A2622', '#ECE8E1', 4.5],
  ['mute / panel', '#4A453F', '#FAF8F4', 4.5],
  ['mute / page', '#4A453F', '#F4F1EC', 4.5],
  ['accent / panel (large)', '#C45C26', '#FAF8F4', 3.0],
  ['accent / page (large)', '#C45C26', '#F4F1EC', 3.0],
  ['accent-ink / panel', '#9A3D14', '#FAF8F4', 4.5],
  ['accent-ink / page', '#9A3D14', '#F4F1EC', 4.5],
  ['accent-ink / speech', '#9A3D14', '#F4F1EC', 4.5],
  ['HC ink / HC panel', '#1A1612', '#F7F3EA', 4.5],
  ['HC mute / HC panel', '#322C26', '#F7F3EA', 4.5],
  ['HC accent / HC panel (large)', '#9A3D14', '#F7F3EA', 3.0],
  ['chip on speech', '#2A2622', '#F4F1EC', 4.5],
];

let fail = 0;
console.log('pair'.padEnd(34), 'ratio'.padStart(6), 'need'.padStart(6), 'ok');
for (const [name, fg, bg, need] of pairs) {
  const r = contrast(fg, bg);
  const ok = r + 1e-6 >= need;
  if (!ok) fail += 1;
  console.log(name.padEnd(34), r.toFixed(2).padStart(6), String(need).padStart(6), ok ? 'PASS' : 'FAIL');
}
if (fail) {
  console.error(`contrast: ${fail} pair(s) below target`);
  process.exit(1);
}
console.log('contrast: all pairs pass');
