/**
 * blueprint-parser.js
 * Converts a pasted blueprint (plain text from ChatGPT) into a chart data
 * object compatible with the existing JSON schema.
 *
 * Expected format:
 *
 *   MAIN GOAL:
 *   [Main Goal text]
 *
 *   PILLAR 1:
 *   [Pillar Name]
 *
 *   TASKS:
 *   1. [Task]
 *   2. [Task]
 *   ...
 *   8. [Task]
 *
 *   PILLAR 2:
 *   ... (repeat through PILLAR 8)
 *
 * Tolerances:
 *   - Pillar name may appear on the same line as "PILLAR N:" or the line below.
 *   - Main goal may appear on the same line as "MAIN GOAL:" or the line below.
 *   - Task numbers may use "1." or "1)" notation.
 *   - Extra blank lines and whitespace are ignored.
 *   - Lines that don't match any keyword are ignored (safe to paste rich text).
 */

import {
  POSITION_ORDER,
  DEFAULT_PILLAR_COLORS,
  DEFAULT_MAIN_GOAL_COLOR,
} from './utils.js';

const ACTION_POSITIONS = ['TL', 'TC', 'TR', 'ML', 'MR', 'BL', 'BC', 'BR'];

/**
 * @param {string} text - Raw blueprint text pasted by the user.
 * @returns {{ data: object|null, warnings: string[], errors: string[] }}
 */
export function parseBlueprint(text) {
  const warnings = [];
  const errors   = [];

  const lines = text.replace(/\r\n?/g, '\n').split('\n');

  const data = {
    meta: { title: '', author: '', version: '1.0' },
    mainGoal: {
      text:            '',
      backgroundColor: DEFAULT_MAIN_GOAL_COLOR.backgroundColor,
      textColor:       DEFAULT_MAIN_GOAL_COLOR.textColor,
    },
    pillars: [],
  };

  // State machine: tracks what the next non-empty line should be treated as.
  // 'IDLE'         — looking for a keyword
  // 'MAIN_GOAL'    — next content line is the main goal text
  // 'PILLAR_NAME'  — next content line is the current pillar's name
  // 'TASKS'        — reading numbered task lines for the current pillar
  let state         = 'IDLE';
  let currentPillar = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue; // skip blank lines

    // ── Section keyword checks (highest priority, override state) ──

    // MAIN GOAL: (inline value optional)
    const mainGoalMatch = line.match(/^MAIN\s+GOAL\s*:\s*(.*)/i);
    if (mainGoalMatch) {
      const inline = mainGoalMatch[1].trim();
      if (inline) {
        data.mainGoal.text = inline;
        state = 'IDLE';
      } else {
        state = 'MAIN_GOAL';
      }
      continue;
    }

    // PILLAR N: (inline value optional, N = 1–8)
    const pillarMatch = line.match(/^PILLAR\s+(\d+)\s*:\s*(.*)/i);
    if (pillarMatch) {
      const num = parseInt(pillarMatch[1], 10);
      if (num < 1 || num > 8) {
        warnings.push(`PILLAR ${num} is out of range (1–8) and was skipped.`);
        currentPillar = null;
        state = 'IDLE';
        continue;
      }
      const position = POSITION_ORDER[num - 1];
      if (data.pillars.find((p) => p.position === position)) {
        warnings.push(`Duplicate PILLAR ${num} — the second definition was ignored.`);
        currentPillar = null;
        state = 'IDLE';
        continue;
      }
      const colors = DEFAULT_PILLAR_COLORS[position];
      currentPillar = {
        position,
        text:            '',
        backgroundColor: colors.backgroundColor,
        textColor:       colors.textColor,
        actions:         [],
      };
      data.pillars.push(currentPillar);

      const inline = pillarMatch[2].trim();
      if (inline) {
        currentPillar.text = inline;
        state = 'IDLE';
      } else {
        state = 'PILLAR_NAME';
      }
      continue;
    }

    // TASKS: (or TASK:)
    if (/^TASKS?\s*:/i.test(line)) {
      state = 'TASKS';
      continue;
    }

    // ── State-based content reading ──

    if (state === 'MAIN_GOAL') {
      data.mainGoal.text = line;
      state = 'IDLE';
      continue;
    }

    if (state === 'PILLAR_NAME') {
      if (currentPillar) currentPillar.text = line;
      state = 'IDLE';
      continue;
    }

    if (state === 'TASKS') {
      // Accept "1. text", "1) text", or "1 text" (number followed by separator)
      const taskMatch = line.match(/^(\d+)[.)]\s+(.+)/);
      if (taskMatch && currentPillar) {
        const num  = parseInt(taskMatch[1], 10);
        const text = taskMatch[2].trim();
        if (num >= 1 && num <= 8 && text) {
          const actionPos = ACTION_POSITIONS[num - 1];
          if (!currentPillar.actions.find((a) => a.position === actionPos)) {
            currentPillar.actions.push({ position: actionPos, text });
          }
        }
      }
      // Non-matching lines inside TASKS are silently ignored (e.g. sub-headings).
      continue;
    }

    // IDLE — content line with no matching keyword is ignored.
  }

  // ── Post-parse validation ──

  if (!data.mainGoal.text) {
    errors.push(
      'No MAIN GOAL found. Make sure your blueprint includes a line that reads "MAIN GOAL:" ' +
      'followed by your goal.'
    );
  }

  if (data.pillars.length === 0) {
    errors.push(
      'No pillars found. Make sure each section is labelled "PILLAR 1:", "PILLAR 2:", etc.'
    );
  } else if (data.pillars.length < 8) {
    warnings.push(
      `Only ${data.pillars.length} of 8 pillars found. ` +
      'The missing sections will appear empty on the chart.'
    );
  }

  return { data, warnings, errors };
}
