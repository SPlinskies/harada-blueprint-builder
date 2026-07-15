/**
 * text-fitter.js
 * DOM-ruler text-fitting utility.
 *
 * Reduces the font size of a span until its wrapped text fits within a given
 * pixel area, respecting an optional maximum line count.
 *
 * Why DOM ruler instead of canvas?
 * Canvas font metrics do not reliably resolve system-ui (or other OS-aliased
 * fonts) the same way the browser renders them in the DOM, causing systematic
 * over-measurement and fonts that shrink far below what is actually needed.
 * A hidden DOM span uses the same rendering engine as the cell, so measurements
 * are always accurate regardless of font stack or OS.
 *
 * Two-phase fit:
 *   Phase 1 — reduce size until the longest individual word fits horizontally.
 *             Prevents overflow-wrap from breaking words mid-character.
 *   Phase 2 — reduce size until all wrapped lines fit within maxH and the
 *             wrapped line count is at or below maxLines.
 */

let _ruler = null;

function getRuler(fontFamily) {
  if (!_ruler) {
    const el = document.createElement('span');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = [
      'position:fixed',
      'top:-9999px',
      'left:-9999px',
      'white-space:nowrap',
      'visibility:hidden',
      'pointer-events:none',
      'user-select:none',
    ].join(';');
    document.body.appendChild(el);
    _ruler = el;
  }
  _ruler.style.fontFamily = fontFamily;
  return _ruler;
}

/**
 * Shrinks the font size of `span` until its text fits within (maxW × maxH)
 * with at most `maxLines` wrapped lines.
 *
 * The span's `font-size` style is set directly; all other styles are untouched.
 * If the text already fits at the CSS-computed size, no change is made.
 *
 * @param {HTMLSpanElement} span
 * @param {number} maxW                     Available width in px (cell width − padding).
 * @param {number} maxH                     Available height in px (cell height − padding).
 * @param {object} [opts]
 * @param {number} [opts.minSize=7]         Floor font size in px; never goes below this.
 * @param {number} [opts.maxLines=Infinity] Maximum number of wrapped lines allowed.
 * @param {number} [opts.lineHeight=1.25]   Line-height multiplier (must match CSS).
 */
export function fitText(span, maxW, maxH, { minSize = 7, maxLines = Infinity, lineHeight = 1.25 } = {}) {
  const text = span?.textContent?.trim();
  if (!text || maxW <= 0 || maxH <= 0) return;

  const cs         = getComputedStyle(span);
  const fontWeight = cs.fontWeight;
  const fontFamily = cs.fontFamily;
  let   size       = parseFloat(cs.fontSize);

  const ruler = getRuler(fontFamily);
  const words = text.split(/\s+/);

  const measure = (str, sz) => {
    ruler.style.fontWeight = fontWeight;
    ruler.style.fontSize   = `${sz}px`;
    ruler.textContent      = str;
    return ruler.getBoundingClientRect().width;
  };

  const maxWordWidth = (sz) => Math.max(...words.map((w) => measure(w, sz)));

  const lineCount = (sz) => {
    const spW = measure(' ', sz);
    let lines = 1, lineW = 0;
    words.forEach((word, i) => {
      const wW = measure(word, sz);
      if (i === 0) { lineW = wW; return; }
      if (lineW + spW + wW <= maxW) { lineW += spW + wW; }
      else                          { lines++;  lineW = wW; }
    });
    return lines;
  };

  // Phase 1 — fit the longest word horizontally (prevents mid-word breaks).
  while (size > minSize && maxWordWidth(size) > maxW) size -= 0.5;

  // Phase 2 — fit all wrapped lines within maxH and the maxLines constraint.
  while (size > minSize) {
    const lines = lineCount(size);
    if (lines <= maxLines && lines * size * lineHeight <= maxH) break;
    size -= 0.5;
  }

  span.style.fontSize = `${size}px`;
}
