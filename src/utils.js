/**
 * utils.js
 * Shared constants and position maps for the Harada rendering engine.
 * Nothing in here knows about any specific chart's content.
 */

// Canonical order used when iterating the 8 pillar positions.
export const POSITION_ORDER = ['NW', 'N', 'NE', 'W', 'E', 'SW', 'S', 'SE'];

/**
 * Maps a pillar's compass position to its slot in the outer 3×3 chart grid.
 * Row/col are 1-indexed CSS grid values.
 *
 *  [NW][N ][NE]
 *  [W ][CT][E ]
 *  [SW][S ][SE]
 */
export const PILLAR_BLOCK_GRID = {
  NW: { row: 1, col: 1 },
  N:  { row: 1, col: 2 },
  NE: { row: 1, col: 3 },
  W:  { row: 2, col: 1 },
  E:  { row: 2, col: 3 },
  SW: { row: 3, col: 1 },
  S:  { row: 3, col: 2 },
  SE: { row: 3, col: 3 },
};

/**
 * Maps a pillar's compass position to its cell slot inside the center block.
 * The center block's (2,2) is always the main goal.
 *
 *  [NW][N ][NE]
 *  [W ][MG][E ]   ← MG = main goal
 *  [SW][S ][SE]
 */
export const PILLAR_CENTER_CELL = {
  NW: { row: 1, col: 1 },
  N:  { row: 1, col: 2 },
  NE: { row: 1, col: 3 },
  W:  { row: 2, col: 1 },
  E:  { row: 2, col: 3 },
  SW: { row: 3, col: 1 },
  S:  { row: 3, col: 2 },
  SE: { row: 3, col: 3 },
};

/**
 * Maps an action item's position label to its cell slot inside an outer block.
 * The outer block's (2,2) is always the pillar label.
 *
 *  [TL][TC][TR]
 *  [ML][PL][MR]   ← PL = pillar label
 *  [BL][BC][BR]
 */
export const ACTION_CELL_POS = {
  TL: { row: 1, col: 1 },
  TC: { row: 1, col: 2 },
  TR: { row: 1, col: 3 },
  ML: { row: 2, col: 1 },
  MR: { row: 2, col: 3 },
  BL: { row: 3, col: 1 },
  BC: { row: 3, col: 2 },
  BR: { row: 3, col: 3 },
};

/**
 * Default pillar colors, keyed by compass position.
 * Applied when a pillar in the JSON omits backgroundColor / textColor.
 */
export const DEFAULT_PILLAR_COLORS = {
  NW: { backgroundColor: '#2d6a4f', textColor: '#ffffff' },
  N:  { backgroundColor: '#3a86ff', textColor: '#ffffff' },
  NE: { backgroundColor: '#06d6a0', textColor: '#000000' },
  W:  { backgroundColor: '#bc6c25', textColor: '#ffffff' },
  E:  { backgroundColor: '#00b4d8', textColor: '#000000' },
  SW: { backgroundColor: '#ffd166', textColor: '#000000' },
  S:  { backgroundColor: '#f77f00', textColor: '#ffffff' },
  SE: { backgroundColor: '#e040fb', textColor: '#ffffff' },
};

export const DEFAULT_MAIN_GOAL_COLOR = {
  backgroundColor: '#e63946',
  textColor: '#ffffff',
};
