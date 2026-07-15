/**
 * main.js
 * Entry point. Wires together: JSON load → render on startup, Paste Blueprint
 * modal, CSV import, and inline cell editing.
 *
 * Module-level `currentData` is the single source of truth for the live chart.
 * All edits mutate it in place; every change triggers a full re-render via
 * `redraw()`, which rebuilds the DOM from the updated data model.
 */

import { HaradaRenderer }  from './renderer.js';
import { validate }         from './validator.js';
import { importCSV }        from './csv-importer.js';
import { parseBlueprint }   from './blueprint-parser.js';
import { DEFAULT_PILLAR_COLORS, DEFAULT_MAIN_GOAL_COLOR } from './utils.js';

// ── Module state ───────────────────────────────────────────────────
let currentData = null;
let chartRoot   = null;
let warningsEl  = null;

const BLUEPRINT_PLACEHOLDER = [
  'MAIN GOAL:',
  'Your main goal here',
  '',
  'PILLAR 1:',
  'Pillar name',
  '',
  'TASKS:',
  '1. First action',
  '2. Second action',
  '3. Third action',
  '4. Fourth action',
  '5. Fifth action',
  '6. Sixth action',
  '7. Seventh action',
  '8. Eighth action',
  '',
  'PILLAR 2:',
  '(continue through PILLAR 8)',
].join('\n');

// ── Startup ────────────────────────────────────────────────────────

async function init() {
  chartRoot  = document.getElementById('chart-root');
  warningsEl = document.getElementById('chart-warnings');

  let data;
  try {
    const res = await fetch('./data/sample-data.json');
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    data = await res.json();
  } catch (err) {
    renderError(
      `Could not load chart data.\n\n${err.message}\n\n` +
      'Make sure you are serving this project via a local web server (see README.md).'
    );
    return;
  }

  loadChart(data);           // validate, store, render
  setupCellEditing();        // attach delegated listener once — survives all re-renders
  setupBlueprintModal();
  setupImportButton();
  setupPrintMode();
}

// ── Chart load / re-render ─────────────────────────────────────────

/**
 * Validates data, stores it as currentData, and renders the chart.
 * Call this when a completely new data set arrives (paste, CSV, startup).
 */
function loadChart(data) {
  const { valid, errors, warnings } = validate(data);

  showWarningBanner(warnings);

  if (!valid) {
    renderError(`Chart data contains errors:\n\n• ${errors.join('\n• ')}`);
    return;
  }

  currentData = data;
  redraw();
}

/**
 * Re-renders the chart from currentData without re-validating.
 * Called after every inline cell edit.
 */
function redraw() {
  if (!currentData) return;
  new HaradaRenderer(currentData).render(chartRoot);
  updateAllTitles();
}

// ── Title management ───────────────────────────────────────────────

/**
 * Single source of truth for the display title.
 * mainGoal.text takes precedence over meta.title because blueprint imports
 * set mainGoal.text but leave meta.title empty.
 */
function getTitle() {
  return (currentData?.mainGoal?.text || currentData?.meta?.title || '').trim();
}

/**
 * Syncs every title surface from the current data.
 * Called by redraw() so inline edits, pastes, and CSV imports all
 * update the browser tab and the print/PDF title automatically.
 */
function updateAllTitles() {
  const title = getTitle();
  document.title = title || 'Harada Chart';

  const titleTextEl = document.getElementById('print-title-text');
  const titleEl     = document.getElementById('print-title');
  if (titleTextEl) titleTextEl.textContent = title;
  if (titleEl)     titleEl.classList.toggle('print-title--no-content', !title);
}

// ── Inline cell editing ────────────────────────────────────────────

/**
 * Attaches a single delegated click listener to chartRoot.
 * Called once on startup — survives all re-renders because those only
 * replace chartRoot's children, not chartRoot itself.
 */
function setupCellEditing() {
  chartRoot.addEventListener('click', (e) => {
    if (!currentData) return;
    const cell = e.target.closest('.harada-cell');
    if (!cell || cell.dataset.editing) return;
    activateEdit(cell);
  });
}

/**
 * Replaces a cell's text span with an editable textarea.
 * Enter / blur → save.  Escape → cancel (restores previous value).
 */
function activateEdit(cell) {
  const { cellType, pillarPos, actionPos } = cell.dataset;
  if (!cellType) return; // safety guard — untyped cells are not editable

  const span         = cell.querySelector('.harada-cell__text');
  const originalText = span?.textContent?.trim() ?? '';

  // Read the fitted font size before we destroy the span.
  const fittedSize = span ? window.getComputedStyle(span).fontSize : null;

  // Mark the cell as editing (triggers the focus ring via CSS).
  cell.dataset.editing = 'true';
  cell.innerHTML = '';

  const ta = document.createElement('textarea');
  ta.className = 'cell-edit-input';
  ta.value     = originalText;
  if (fittedSize) ta.style.fontSize = fittedSize;
  cell.appendChild(ta);
  ta.focus();
  ta.select();

  // `saved` prevents both blur and keydown from double-firing after the
  // first save/cancel (re-render detaches the textarea, triggering blur).
  let saved = false;

  const doSave = () => {
    if (saved) return;
    saved = true;
    const newText = ta.value.trim();
    applyEdit(cellType, pillarPos, actionPos, newText);
    // applyEdit calls redraw(), which replaces the DOM including this textarea.
  };

  const doCancel = () => {
    if (saved) return;
    saved = true;
    redraw(); // re-renders from currentData with no change applied
  };

  ta.addEventListener('blur', doSave);

  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doSave();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      doCancel();
    }
  });
}

/**
 * Mutates currentData at the location identified by (cellType, pillarPos, actionPos),
 * then re-renders. Creating missing pillars/actions is supported so that
 * empty cells in an imported chart can be filled in.
 */
function applyEdit(cellType, pillarPos, actionPos, newText) {
  if (!currentData) return;

  if (cellType === 'goal') {
    currentData.mainGoal.text = newText;
  }

  else if (cellType === 'pillar') {
    const existing = currentData.pillars.find((p) => p.position === pillarPos);
    if (existing) {
      existing.text = newText;
    } else if (newText) {
      // Create a new pillar at this compass position using default colours.
      const colors = DEFAULT_PILLAR_COLORS[pillarPos] ?? {
        backgroundColor: DEFAULT_MAIN_GOAL_COLOR.backgroundColor,
        textColor:       DEFAULT_MAIN_GOAL_COLOR.textColor,
      };
      currentData.pillars.push({
        position:        pillarPos,
        text:            newText,
        backgroundColor: colors.backgroundColor,
        textColor:       colors.textColor,
        actions:         [],
      });
    }
    // If newText is empty and no pillar existed, nothing changes.
  }

  else if (cellType === 'task') {
    const pillar = currentData.pillars.find((p) => p.position === pillarPos);
    if (!pillar) return; // can't add a task without a pillar

    const existing = pillar.actions.find((a) => a.position === actionPos);
    if (existing) {
      if (newText) {
        existing.text = newText;
      } else {
        // Empty text → remove the action so the cell stays blank.
        pillar.actions = pillar.actions.filter((a) => a.position !== actionPos);
      }
    } else if (newText) {
      pillar.actions.push({ position: actionPos, text: newText });
    }
  }

  redraw();
}

// ── Paste Blueprint modal ──────────────────────────────────────────

function setupBlueprintModal() {
  const modal       = document.getElementById('bp-modal');
  const textarea    = document.getElementById('bp-textarea');
  const errorsEl    = document.getElementById('bp-errors');
  const btnOpen     = document.getElementById('btn-paste-blueprint');
  const btnCancel   = document.getElementById('btn-bp-cancel');
  const btnGenerate = document.getElementById('btn-bp-generate');
  const backdrop    = document.getElementById('bp-backdrop');

  if (!modal || !textarea) return;

  textarea.placeholder = BLUEPRINT_PLACEHOLDER;

  const openModal = () => {
    textarea.value  = '';
    modal.hidden    = false;
    errorsEl.hidden = true;
    errorsEl.innerHTML = '';
    textarea.focus();
  };

  const closeModal = () => { modal.hidden = true; };

  btnOpen?.addEventListener('click', openModal);
  btnCancel?.addEventListener('click', closeModal);
  backdrop?.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });

  btnGenerate?.addEventListener('click', () => {
    const text = textarea.value.trim();
    if (!text) {
      showModalError(errorsEl, ['Please paste your blueprint text before generating.']);
      return;
    }

    const { data, warnings: parseWarnings, errors: parseErrors } = parseBlueprint(text);

    if (parseErrors.length > 0) {
      showModalError(errorsEl, parseErrors);
      return;
    }

    const { valid, errors: schemaErrors, warnings: schemaWarnings } = validate(data);
    if (!valid) {
      showModalError(errorsEl, schemaErrors);
      return;
    }

    closeModal();
    showWarningBanner([...parseWarnings, ...schemaWarnings]);
    currentData = data;
    redraw();
  });
}

// ── CSV import ─────────────────────────────────────────────────────

function setupImportButton() {
  const btn   = document.getElementById('btn-import');
  const input = document.getElementById('csv-file-input');
  if (!btn || !input) return;

  btn.addEventListener('click', () => input.click());

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;

    btn.textContent = 'Loading…';
    btn.disabled    = true;

    try {
      const csvText = await file.text();
      const { data, warnings: importWarnings, errors: importErrors } = importCSV(csvText);

      if (importErrors.length > 0) {
        showWarningBanner([], importErrors);
        return;
      }

      const { valid, errors, warnings: schemaWarnings } = validate(data);
      showWarningBanner([...importWarnings, ...schemaWarnings]);

      if (!valid) {
        renderError(`Imported data has errors:\n\n• ${errors.join('\n• ')}`);
        return;
      }

      currentData = data;
      redraw();
    } catch (err) {
      showWarningBanner([], [`Could not read the file: ${err.message}`]);
    } finally {
      btn.textContent = 'Import CSV';
      btn.disabled    = false;
      input.value     = '';
    }
  });
}

// ── Print Mode ─────────────────────────────────────────────────────

function setupPrintMode() {
  document.getElementById('btn-print-mode')?.addEventListener('click', enterPrintMode);
  document.getElementById('btn-back-to-edit')?.addEventListener('click', exitPrintMode);

  // Both "Save as PDF" buttons (nav + print bar) enter print mode first so
  // the nav and edit UI are hidden before the browser's print dialog opens.
  const triggerPrint = () => {
    if (!document.body.classList.contains('print-mode')) enterPrintMode();
    setTimeout(() => window.print(), 80);
  };
  document.getElementById('btn-save-pdf')?.addEventListener('click', triggerPrint);
  document.getElementById('btn-print-pdf')?.addEventListener('click', triggerPrint);
}

function enterPrintMode() {
  // Save any open cell edit before switching modes.
  // updateAllTitles() (called by redraw after the edit saves) ensures the
  // print-title element is already up to date before we reveal it.
  document.querySelector('.cell-edit-input')?.blur();
  document.body.classList.add('print-mode');
}

function exitPrintMode() {
  document.body.classList.remove('print-mode');
}

// ── Helpers ────────────────────────────────────────────────────────

function showWarningBanner(warnings = [], errors = []) {
  if (!warningsEl) return;
  const items = [
    ...errors.map((e)  => `<li class="chart-warnings__error">${escapeHtml(e)}</li>`),
    ...warnings.map((w) => `<li>${escapeHtml(w)}</li>`),
  ];
  warningsEl.innerHTML = items.join('');
  warningsEl.hidden    = items.length === 0;
}

function showModalError(errorsEl, errors) {
  errorsEl.innerHTML = errors.map(escapeHtml).join('<br>');
  errorsEl.hidden    = false;
}

function renderError(message) {
  if (!chartRoot) return;
  chartRoot.innerHTML = `<div class="harada-error"><pre>${escapeHtml(message)}</pre></div>`;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

init();
