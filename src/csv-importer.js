/**
 * csv-importer.js
 * Converts a raw CSV string into a chart data object compatible with the
 * existing JSON schema (data/sample-data.json).
 *
 * Public API:
 *   import { importCSV } from './csv-importer.js';
 *   const { data, warnings, errors } = importCSV(csvString);
 *
 * The importer has no knowledge of the renderer or the DOM. It is a pure
 * data-transformation function — the same function can be reused for future
 * import methods (Google Sheets API, form wizard, AI, JSON editor, etc.).
 *
 * CSV format expected (see template/harada-template.csv):
 *   Column A — keyword (CHART TITLE, MAIN GOAL, PILLAR 1–8, ACTION 1–8)
 *   Column B — content
 *   Column C and beyond — ignored (used for notes in the template)
 *
 * Pillar number maps to compass position:
 *   1→NW, 2→N, 3→NE, 4→W, 5→E, 6→SW, 7→S, 8→SE
 *
 * Action number maps to cell position:
 *   1→TL, 2→TC, 3→TR, 4→ML, 5→MR, 6→BL, 7→BC, 8→BR
 */

import {
  POSITION_ORDER,
  DEFAULT_PILLAR_COLORS,
  DEFAULT_MAIN_GOAL_COLOR,
} from './utils.js';

// Action positions in order — index 0 = ACTION 1, index 7 = ACTION 8.
const ACTION_POSITIONS = ['TL', 'TC', 'TR', 'ML', 'MR', 'BL', 'BC', 'BR'];

/**
 * Parses a CSV string into a 2-D array of strings.
 * Handles: quoted fields, escaped double-quotes (""), Windows/Mac/Unix line endings.
 * @param {string} rawText
 * @returns {string[][]}
 */
function parseCSVText(rawText) {
  const text = rawText.replace(/\r\n?/g, '\n');
  const rows = [];
  let i = 0;

  while (i < text.length) {
    const row = [];

    while (i < text.length && text[i] !== '\n') {
      let cell = '';

      if (text[i] === '"') {
        // Quoted field — consume everything until a closing unescaped quote.
        i++;
        while (i < text.length) {
          if (text[i] === '"') {
            if (text[i + 1] === '"') { cell += '"'; i += 2; } // escaped ""
            else                     { i++; break; }          // closing quote
          } else {
            cell += text[i++];
          }
        }
        // Advance past the comma that follows (if any).
        if (text[i] === ',') i++;
      } else {
        // Unquoted field — read until comma or newline.
        while (i < text.length && text[i] !== ',' && text[i] !== '\n') {
          cell += text[i++];
        }
        if (text[i] === ',') i++;
      }

      row.push(cell);
    }

    if (text[i] === '\n') i++;
    rows.push(row);
  }

  return rows;
}

/**
 * Converts a CSV string into a Harada chart data object.
 *
 * @param {string} csvText - Raw CSV content from a .csv file.
 * @returns {{
 *   data:     object|null,
 *   warnings: string[],
 *   errors:   string[]
 * }}
 */
export function importCSV(csvText) {
  const warnings = [];
  const errors   = [];

  let rows;
  try {
    rows = parseCSVText(csvText);
  } catch (e) {
    return { data: null, warnings, errors: [`CSV parsing failed: ${e.message}`] };
  }

  const data = {
    meta: { title: '', author: '', version: '1.0' },
    mainGoal: {
      text:            '',
      backgroundColor: DEFAULT_MAIN_GOAL_COLOR.backgroundColor,
      textColor:       DEFAULT_MAIN_GOAL_COLOR.textColor,
    },
    pillars: [],
  };

  let currentPillar = null;

  for (const row of rows) {
    const keyword = (row[0] ?? '').trim().toUpperCase();
    const value   = (row[1] ?? '').trim();

    if (!keyword) continue; // blank or separator row

    // ── Known keywords ─────────────────────────────────────────────

    if (keyword === 'CHART TITLE') {
      data.meta.title = value;
      continue;
    }

    if (keyword === 'MAIN GOAL') {
      data.mainGoal.text = value;
      continue;
    }

    // PILLAR N — starts a new pillar section (N must be 1–8)
    const pillarMatch = keyword.match(/^PILLAR\s+(\d+)$/);
    if (pillarMatch) {
      const num = parseInt(pillarMatch[1], 10);
      if (num < 1 || num > 8) {
        warnings.push(`Pillar number ${num} is out of range (1–8) and was skipped.`);
        currentPillar = null;
        continue;
      }
      const position = POSITION_ORDER[num - 1];
      if (data.pillars.find((p) => p.position === position)) {
        warnings.push(`Duplicate PILLAR ${num} found in CSV — the second entry was ignored.`);
        currentPillar = null;
        continue;
      }
      const colors = DEFAULT_PILLAR_COLORS[position];
      currentPillar = {
        position,
        text:            value,
        backgroundColor: colors.backgroundColor,
        textColor:       colors.textColor,
        actions:         [],
      };
      data.pillars.push(currentPillar);
      continue;
    }

    // ACTION N — adds an action to the current pillar (N must be 1–8)
    const actionMatch = keyword.match(/^ACTION\s+(\d+)$/);
    if (actionMatch) {
      if (!currentPillar) {
        warnings.push(`ACTION ${actionMatch[1]} found before any PILLAR row — skipped.`);
        continue;
      }
      const num = parseInt(actionMatch[1], 10);
      if (num < 1 || num > 8) {
        warnings.push(
          `Action number ${num} in pillar "${currentPillar.text}" is out of range (1–8) and was skipped.`
        );
        continue;
      }
      const actionPos = ACTION_POSITIONS[num - 1];
      if (currentPillar.actions.find((a) => a.position === actionPos)) {
        warnings.push(
          `Duplicate ACTION ${num} in pillar "${currentPillar.text}" — the second entry was ignored.`
        );
        continue;
      }
      if (value) {
        currentPillar.actions.push({ position: actionPos, text: value });
      }
      // Blank ACTION rows are silently skipped — leaves that cell empty on the chart.
      continue;
    }

    // ── Unknown keyword — silently ignored ─────────────────────────
    // Allows instructional rows in the template (e.g. "HOW TO USE", "── PILLAR 1 ──")
    // to exist without causing warnings.
  }

  // ── Post-parse warnings ─────────────────────────────────────────

  if (!data.mainGoal.text) {
    errors.push('MAIN GOAL is empty. Add your main goal to the MAIN GOAL row in the CSV.');
  }

  if (data.pillars.length === 0) {
    errors.push(
      'No pillars were found. Make sure your CSV file uses the correct template format ' +
      '(see template/harada-template.csv).'
    );
  } else if (data.pillars.length < 8) {
    warnings.push(
      `Only ${data.pillars.length} of 8 pillars were found. ` +
      'The missing sections will appear empty on the chart.'
    );
  }

  return { data, warnings, errors };
}
