# Harada Blueprint Builder

A browser-based tool for creating Harada Method charts (Mandala Charts).

Paste a plain-text blueprint → the app renders a fully laid-out 9×9 chart → save it as a PDF.

No account, no backend, no build step. Works on desktop and mobile.

---

## What it does

- **New Blueprint** — paste a plain-text blueprint (from ChatGPT or written by hand) and generate the chart instantly
- **Inline editing** — click any cell to edit it directly on the chart
- **Print / Save PDF** — exports a landscape PDF with only the chart and title visible
- **Import CSV** — load chart data from a CSV file

---

## How to run locally

The app uses ES modules and `fetch()`, which require a local web server (not `file://`).

```bash
# Python 3 (no install needed)
cd harada-engine
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080).

Other options: `npx serve .` or VS Code Live Server extension.

---

## How to paste a blueprint

1. Generate a blueprint in ChatGPT (or write one by hand) using this format:

```
MAIN GOAL:
Your main goal here

PILLAR 1:
First pillar name

TASKS:
1. First action
2. Second action
3. Third action
4. Fourth action
5. Fifth action
6. Sixth action
7. Seventh action
8. Eighth action

PILLAR 2:
Second pillar name

TASKS:
1. ...
(continue through PILLAR 8)
```

2. Click **New Blueprint** in the toolbar
3. Paste your blueprint text into the textarea
4. Click **Generate Chart**

The chart renders immediately. Click any cell to edit it inline.

---

## How to print or save as PDF

1. Click **Save as PDF** in the toolbar (or **Print Preview** first to see how it will look)
2. In the browser's print dialog, set orientation to **Landscape**
3. Click Save / Print

The printed output contains only the chart and title — all UI chrome is hidden.

---

## Deployment

This is a static website with no build step. Deploy to any static host.

### Vercel (recommended)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → import the repo
3. Leave all settings at defaults — Vercel auto-detects static sites
4. Deploy

No `vercel.json` or build configuration needed.

---

## File structure

```
harada-engine/
├── index.html              App shell
├── styles.css              All styles (CSS custom properties)
├── data/
│   └── sample-data.json    Default chart loaded on startup
├── src/
│   ├── main.js             Entry point — wires all features together
│   ├── renderer.js         HaradaRenderer — data → DOM
│   ├── text-fitter.js      Responsive text fitting utility
│   ├── blueprint-parser.js Parses plain-text blueprint format
│   ├── csv-importer.js     Parses CSV import format
│   ├── validator.js        Data validation
│   └── utils.js            Position maps and colour defaults
└── template/
    └── harada-template.csv CSV template for import
```
