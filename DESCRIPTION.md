# Visual CSS Layout Designer

## Goal

A fast, no-dependency (vanilla JS) visual editor for composing responsive Flexbox and CSS Grid layouts, with instant code export (Pure CSS or Tailwind) and per‑breakpoint controls — aiming for an intuitive workflow plus clean, production‑ready output.

## Current Feature Set

### Canvas & Structure

* Add Rows, Columns, and Grid Containers; nest freely.
* Auto-wrap raw Columns in a Row when added to root.
* Grid containers auto-seeded with starter cells; add cells or duplicate whole rows.

### Devices & Responsive Model

* Live preview size toggle: Desktop (fluid), Tablet (768px), Mobile (375px).
* Separate "edit device" tabs (D / T / M) in the Properties panel let you author breakpoint overrides independently of the active preview width.

### Properties Panel (Redesigned)

* Scrollable, segmented panel (properties + code) with persistent layout.
* Width / Height with quick buttons and modern viewport variants (svw/dvw/lvw, svh/dvh/lvh).
* Spacing: padding & margin presets.
* Flex Row controls: direction, justify, align.
* Grid Container controls: column count (with presets), gap presets, justify-items, align-items, per‑device column overrides (tablet/mobile), single‑column stacking toggle.
* Grid Item controls: column & row span (with clear).
* Flex child control: flex-grow.
* Per-device visibility (display:none) checkboxes.
* Responsive Row Stacking: toggle to switch rows to vertical at tablet + mobile (<= 768px) automatically.
* Grid Stacking: collapse grids to 1 column at tablet/mobile (unless a specific override exists) via toggle.

### Responsive Overrides

* Device tabs instantly switch property inputs (fast path refresh, no full re-render lag).
* Explicit per-device column templates for grids, plus fallback to stacking rule when missing.

### Code Generation

* Formats: Pure CSS (semantic class series `layout-el-N` + scoped media queries) or Tailwind utilities.
* Auto generation: Debounced, runs after every change (toggleable). Manual button still available.
* Large code viewer modal with HTML/CSS tabs, copy current, copy both, and simple multi-file download bundle.
* Visibility notes appended (which elements are hidden on which breakpoints) for clarity.
* Cleans internal editor artifacts: removes temporary classes (`row`, `col`, `grid-container`, `grid-item`), data attributes, inline styles, selection state, placeholder labels.
* Tailwind mapping includes: display, flex direction, grid columns (uniform 1fr sets), gap (with preset size mapping), spans (col/row), justify/align items, widths/heights (common fractions), grow/shrink, margin, padding, visibility (hidden).

### Interaction & UX Enhancements

* Tooltips with concise explanations for every control.
* Quick value buttons highlight current match.
* Property panel remains scrollable; layout avoids overflow clipping.
* Fast device edit tab switching (no noticeable delay).
* Automatic runtime style application synced to current preview device.

### Internal Architecture

* Per-element `data-styles` JSON: `{ desktop: {}, tablet: {}, mobile: {} }` merged at runtime with cascade logic.
* Flags: `data-responsive-stack` for rows, `data-grid-stack` for grids.
* Style application pipeline ensures deterministic overrides and minimal mutation.
* Export path clones DOM, sanitizes, and formats indentation-friendly HTML.

### Testing

* Lightweight runtime smoke test script (`test/runtime-check.js`) verifies no runtime errors after changes (returns `RUNTIME_CHECK_OK`).

## Roadmap / Next Enhancements

* Persistence: Save / Load layouts (JSON) & sharing.
* Undo / Redo history stack.
* Advanced Grid Tools:
    * Drag multi-cell selection + merge (auto span calculation).
    * Named grid areas & visual area editor.
    * Breakpoint-specific (non-uniform) grid templates (e.g. `2fr 1fr` overrides).
* Visual Indicators: Badge dots on device tabs when overrides exist; diff/inheritance inspector.
* Component / Snippet Library (navbars, hero blocks, cards, footers).
* More Style Controls: Borders, radius, background, shadows, typography, gap axis separation (row/column gaps).
* Semantic Class Export Mode (optional naming + BEM-ish pattern) in addition to numeric classes.
* Enhanced Tailwind Mapping: Support arbitrary values grouping (logical properties, min/max sizes, responsive spacing, per-axis gap) with plugin hints.
* Syntax Highlighting in modal (add lightweight highlighter or custom tokenization).
* Direct Code → Canvas sync (editable HTML/CSS with safe diff application).
* Accessibility Aids: Landmark wrappers (header/nav/main/footer) insertion helpers.
* Performance Profiling: Frame timing overlay for very large layouts.

## Contributing

PRs welcomed for any roadmap item. Please keep additions framework-free (vanilla JS / minimal CSS) unless a compelling need arises.

## License

TBD (add a LICENSE file when ready).
