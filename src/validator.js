/**
 * validator.js
 * Validates Harada chart JSON before the renderer touches it.
 * Returns { valid: boolean, errors: string[], warnings: string[] }.
 */

import { PILLAR_BLOCK_GRID, ACTION_CELL_POS } from './utils.js';

const VALID_PILLAR_POSITIONS = new Set(Object.keys(PILLAR_BLOCK_GRID));
const VALID_ACTION_POSITIONS = new Set(Object.keys(ACTION_CELL_POS));

export function validate(data) {
  const errors = [];
  const warnings = [];

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, errors: ['Data must be a JSON object.'], warnings };
  }

  // ── mainGoal ──────────────────────────────────────────────────────
  if (!data.mainGoal || typeof data.mainGoal !== 'object') {
    errors.push('Missing required field: mainGoal.');
  } else if (!data.mainGoal.text?.trim()) {
    errors.push('mainGoal.text is required and cannot be empty.');
  }

  // ── pillars ───────────────────────────────────────────────────────
  if (!Array.isArray(data.pillars) || data.pillars.length === 0) {
    errors.push('pillars must be a non-empty array.');
    return { valid: false, errors, warnings };
  }

  if (data.pillars.length > 8) {
    warnings.push(
      `${data.pillars.length} pillars supplied — only 8 compass positions exist. ` +
      'Pillars without a valid position will be skipped.'
    );
  }

  const seenPillarPositions = new Set();

  data.pillars.forEach((pillar, i) => {
    const label = pillar.text ? `"${pillar.text}"` : `[index ${i}]`;

    if (!pillar.position) {
      errors.push(`Pillar ${label} is missing the required position property.`);
    } else if (!VALID_PILLAR_POSITIONS.has(pillar.position)) {
      errors.push(
        `Pillar ${label} has an invalid position "${pillar.position}". ` +
        `Allowed values: ${[...VALID_PILLAR_POSITIONS].join(', ')}.`
      );
    } else if (seenPillarPositions.has(pillar.position)) {
      errors.push(`Two pillars share position "${pillar.position}" — each position must be unique.`);
    } else {
      seenPillarPositions.add(pillar.position);
    }

    if (!pillar.text?.trim()) {
      errors.push(`Pillar at position "${pillar.position ?? '?'}" is missing a text value.`);
    }

    if (!Array.isArray(pillar.actions)) return;

    if (pillar.actions.length > 8) {
      warnings.push(
        `Pillar ${label} has ${pillar.actions.length} actions — only 8 positions are available. ` +
        'Items without a valid or unique position will be skipped.'
      );
    }

    const seenActionPositions = new Set();

    pillar.actions.forEach((action, j) => {
      if (!action.position) {
        errors.push(`Action [index ${j}] in pillar ${label} is missing a position.`);
      } else if (!VALID_ACTION_POSITIONS.has(action.position)) {
        errors.push(
          `Action [index ${j}] in pillar ${label} has an invalid position "${action.position}". ` +
          `Allowed values: ${[...VALID_ACTION_POSITIONS].join(', ')}.`
        );
      } else if (seenActionPositions.has(action.position)) {
        errors.push(
          `Duplicate action position "${action.position}" in pillar ${label}.`
        );
      } else {
        seenActionPositions.add(action.position);
      }
    });
  });

  return { valid: errors.length === 0, errors, warnings };
}
