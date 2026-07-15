/**
 * renderer.js
 * HaradaRenderer — converts validated chart data into a live DOM tree.
 *
 * Public API:
 *   const renderer = new HaradaRenderer(data, options);
 *   renderer.render(containerElement);   // mounts into an existing DOM node
 *   renderer.getElement();               // returns detached element (for export / preview)
 *
 * The renderer has no knowledge of any specific chart's content.
 * All layout decisions are driven by position maps in utils.js.
 */

import {
  POSITION_ORDER,
  PILLAR_BLOCK_GRID,
  PILLAR_CENTER_CELL,
  ACTION_CELL_POS,
  DEFAULT_PILLAR_COLORS,
  DEFAULT_MAIN_GOAL_COLOR,
} from './utils.js';

import { fitText } from './text-fitter.js';

export class HaradaRenderer {
  /**
   * @param {object} data    - Validated chart data object.
   * @param {object} options - Reserved for future use (template overrides, etc.).
   */
  constructor(data, options = {}) {
    this.data = data;
    this.options = options;
  }

  // ─────────────────────────────────────────────────────────────────
  // Public methods
  // ─────────────────────────────────────────────────────────────────

  /**
   * Renders the chart into `container`, replacing any existing content.
   * Returns the chart root element.
   * @param {HTMLElement} container
   * @returns {HTMLElement}
   */
  render(container) {
    container.innerHTML = '';
    const chart = this._buildChart();
    container.appendChild(chart);
    // Fit text after the browser has performed layout.
    requestAnimationFrame(() => this._fitAllText(chart));
    return chart;
  }

  /**
   * Builds and returns a detached chart element.
   * Useful for export, print preview, or side-by-side comparison.
   * @returns {HTMLElement}
   */
  getElement() {
    return this._buildChart();
  }

  // ─────────────────────────────────────────────────────────────────
  // Data preparation
  // ─────────────────────────────────────────────────────────────────

  /**
   * Builds a position-keyed map of pillars with fallback colors resolved.
   * @returns {Object.<string, object>}
   */
  _buildPillarMap() {
    const map = {};
    this.data.pillars.forEach((pillar) => {
      const pos = pillar.position;
      if (!PILLAR_BLOCK_GRID[pos]) return; // skip invalid positions
      const defaults = DEFAULT_PILLAR_COLORS[pos];
      map[pos] = {
        ...pillar,
        backgroundColor: pillar.backgroundColor || defaults.backgroundColor,
        textColor:       pillar.textColor       || defaults.textColor,
        borderColor:     pillar.borderColor     || null,
      };
    });
    return map;
  }

  /**
   * Builds a position-keyed map of actions for a single pillar.
   * @param {object} pillar
   * @returns {Object.<string, object>}
   */
  _buildActionMap(pillar) {
    const map = {};
    (pillar.actions || []).forEach((action) => {
      if (ACTION_CELL_POS[action.position]) {
        map[action.position] = action;
      }
    });
    return map;
  }

  // ─────────────────────────────────────────────────────────────────
  // DOM construction
  // ─────────────────────────────────────────────────────────────────

  _buildChart() {
    const pillarMap = this._buildPillarMap();
    const { mainGoal } = this.data;
    const mainGoalBg   = mainGoal.backgroundColor || DEFAULT_MAIN_GOAL_COLOR.backgroundColor;
    const mainGoalText = mainGoal.textColor        || DEFAULT_MAIN_GOAL_COLOR.textColor;

    const chart = document.createElement('div');
    chart.className = 'harada-chart';

    // ── Center block ────────────────────────────────────────────────
    const centerBlock = this._createBlock(2, 2, 'center');

    // Main goal always occupies the center of the center block (row 2, col 2).
    centerBlock.appendChild(this._createCell({
      text:            mainGoal.text,
      role:            'main-goal',
      backgroundColor: mainGoalBg,
      textColor:       mainGoalText,
      gridRow:         2,
      gridCol:         2,
      cellType:        'goal',
    }));

    // Each pillar appears once in the center block at its compass position.
    POSITION_ORDER.forEach((pos) => {
      const pillar  = pillarMap[pos];
      const cellPos = PILLAR_CENTER_CELL[pos];
      centerBlock.appendChild(this._createCell({
        text:            pillar?.text            || '',
        role:            'pillar',
        backgroundColor: pillar?.backgroundColor,
        textColor:       pillar?.textColor,
        borderColor:     pillar?.borderColor,
        gridRow:         cellPos.row,
        gridCol:         cellPos.col,
        cellType:        'pillar',
        pillarPos:       pos,
      }));
    });

    chart.appendChild(centerBlock);

    // ── Outer blocks (one per compass position) ────────────────────
    POSITION_ORDER.forEach((pos) => {
      const pillar       = pillarMap[pos];
      const blockGridPos = PILLAR_BLOCK_GRID[pos];

      const block = this._createBlock(blockGridPos.row, blockGridPos.col, pos.toLowerCase());

      // Pillar label at the center of its own outer block (row 2, col 2).
      block.appendChild(this._createCell({
        text:            pillar?.text            || '',
        role:            'pillar',
        backgroundColor: pillar?.backgroundColor,
        textColor:       pillar?.textColor,
        borderColor:     pillar?.borderColor,
        gridRow:         2,
        gridCol:         2,
        cellType:        'pillar',
        pillarPos:       pos,
      }));

      // Action items — one per defined position; empty cell if position is absent.
      const actionMap = pillar ? this._buildActionMap(pillar) : {};
      Object.entries(ACTION_CELL_POS).forEach(([aPos, { row, col }]) => {
        const action = actionMap[aPos];
        block.appendChild(this._createCell({
          text:      action?.text || '',
          role:      'action',
          gridRow:   row,
          gridCol:   col,
          cellType:  'task',
          pillarPos: pos,
          actionPos: aPos,
        }));
      });

      chart.appendChild(block);
    });

    return chart;
  }

  /**
   * Creates a block element (one of the nine 3×3 sub-grids).
   */
  _createBlock(gridRow, gridCol, modifier = '') {
    const block = document.createElement('div');
    block.className = `harada-block${modifier ? ` harada-block--${modifier}` : ''}`;
    block.style.gridRow    = gridRow;
    block.style.gridColumn = gridCol;
    return block;
  }

  /**
   * Creates a single cell element.
   * @param {object} config
   */
  _createCell({ text = '', role = 'action', backgroundColor, textColor, borderColor, gridRow, gridCol, cellType = '', pillarPos = '', actionPos = '' }) {
    const isEmpty = !text.trim();

    const cell = document.createElement('div');
    cell.className   = `harada-cell harada-cell--${role}${isEmpty ? ' harada-cell--empty' : ''}`;
    cell.dataset.role = role;
    if (cellType)  cell.dataset.cellType  = cellType;
    if (pillarPos) cell.dataset.pillarPos = pillarPos;
    if (actionPos) cell.dataset.actionPos = actionPos;
    cell.style.gridRow    = gridRow;
    cell.style.gridColumn = gridCol;

    if (backgroundColor) cell.style.backgroundColor = backgroundColor;
    if (textColor)       cell.style.color           = textColor;

    // borderColor is rendered as an inset outline to avoid affecting layout.
    if (borderColor) {
      cell.style.outline       = `3px solid ${borderColor}`;
      cell.style.outlineOffset = '-3px';
    }

    const span = document.createElement('span');
    span.className   = 'harada-cell__text';
    span.textContent = text;
    cell.appendChild(span);

    return cell;
  }

  // ─────────────────────────────────────────────────────────────────
  // Text fitting — canvas-based, so it works independently of DOM state
  // ─────────────────────────────────────────────────────────────────

  _fitAllText(chart) {
    // Cell dimensions are uniform — read once from the first cell.
    const sampleCell = chart.querySelector('.harada-cell');
    if (!sampleCell) return;

    const cellW = sampleCell.clientWidth;
    const cellH = sampleCell.clientHeight;
    if (!cellW || !cellH) return;

    // Read actual computed padding so this stays correct when CSS changes.
    const cs   = getComputedStyle(sampleCell);
    const padW = parseFloat(cs.paddingLeft)  + parseFloat(cs.paddingRight);
    const padH = parseFloat(cs.paddingTop)   + parseFloat(cs.paddingBottom);
    const maxW = cellW - padW;
    const maxH = cellH - padH;

    chart.querySelectorAll('.harada-cell').forEach((cell) => {
      const span = cell.querySelector('.harada-cell__text');
      if (!span) return;

      // Pillar labels and the main goal are limited to 3 lines so long names
      // reduce in size rather than overflowing the cell vertically.
      const isLabel = cell.classList.contains('harada-cell--pillar') ||
                      cell.classList.contains('harada-cell--main-goal');

      fitText(span, maxW, maxH, isLabel ? { maxLines: 3 } : {});
    });
  }
}
