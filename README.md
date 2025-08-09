# CSS Layout Designer (Flex & Grid)

Lightweight (vanilla JS, no build tooling) visual editor for composing responsive Flexbox and CSS Grid layouts with instant HTML + CSS or Tailwind exports. Designed for speed, clarity, and clean output (no editor cruft).

> Tip: Open `public/index.html` directly in a browser (or any static server) — no build step required.

## 🚀 Key Features

### Structure

* Add / nest Rows, Columns, and Grid Containers (auto-wrap loose Columns in a Row).
* Grid: adjustable column count + presets, gap presets, per‑device overrides, add cell or duplicate row.
* Grid Item spans (col / row) with clear.

### Responsive Editing

* Preview device width: Desktop (fluid), Tablet (768px), Mobile (375px).
* Separate property edit tabs (D / T / M) for breakpoint‑specific overrides without changing preview width.
* Row stacking toggle (switch to vertical at tablet & mobile).
* Grid stacking toggle (single column at tablet & mobile unless overridden by explicit template).
* Per‑device visibility (display:none) checkboxes.

### Properties Panel

* Width / Height (modern viewport units svw/dvw/lvw & svh/dvh/lvh) + quick presets.
* Padding & Margin presets.
* Flex row: direction, justify, align.
* Grid container: columns, gap, justify-items, align-items, tablet/mobile column overrides, stacking.
* Flex child: flex-grow.
* Grid item: spans.
* Tooltips on every control.

### Code Generation

* Pure CSS: sequential classes (`layout-el-N`) + scoped media queries (≤768px, ≤375px).
* Tailwind: utility classes with md: / sm: prefixes (tablet / mobile) and value fallbacks for unmapped cases (custom `[value]` syntax).
* Auto update (debounced) after each change — toggleable.
* Large modal viewer: HTML / CSS tabs, copy current/both, simple bundle download.
* Cleans editor artifacts (internal classes, data attributes, placeholder labels, inline styles).
* Visibility notes appended for clarity.

### Performance & UX

* Fast device tab switching (in-place value refresh).
* Debounced auto-generation (~120ms idle).
* Scroll-separated Properties & Code sections.
* Minimal DOM writes; style merging per element via structured `data-styles` JSON.

## 🧠 Data Model

Each element stores:

```jsonc
data-styles = {
  "desktop": { /* base styles */ },
  "tablet":  { /* overrides */ },
  "mobile":  { /* overrides */ }
}
```

Flags:

* `data-responsive-stack` (rows) – enables column layout switch at tablet/mobile.
* `data-grid-stack` (grids) – collapses grid to single column (unless per-device template provided).

At runtime styles are merged (desktop → tablet → mobile) depending on the active preview device, then augmented by stacking logic.

## 🧪 Testing

`test/runtime-check.js` performs a smoke test ensuring no runtime errors (prints `RUNTIME_CHECK_OK`).

Run it (optional):

```bash
npm run test:runtime
```

## 📦 Quick Start

1. Clone repo.
2. Open `public/index.html` in a modern browser, or serve the root with any static server.
3. Add Rows / Columns / Grids; select elements to edit properties.
4. Switch preview device (top center) vs. property edit device (D/T/M tabs) as needed.
5. Enable stacking/visibility overrides; adjust grid columns and spans.
6. Inspect auto-updating code or toggle off and press Generate manually.
7. Use modal viewer to copy/download code.

## 🛠 Tailwind Mapping Notes

* Uniform `1fr` templates → `grid-cols-N` else fallback to arbitrary `grid-cols-[...]`.
* Gap presets map to standard scale; arbitrary gaps become `gap-[value]`.
* Spans: `span X / span X` → `col-span-X` or `row-span-X`.
* Visibility `display:none` → `hidden`.
* Unrecognized values fallback to bracketed utilities (`w-[...], p-[...]`).

## 🗺 Roadmap (Highlights)

See `DESCRIPTION.md` for a fuller list.

* Layout persistence (save/load JSON), undo/redo.
* Advanced grid editing (drag merge, named areas, per-breakpoint non-uniform templates).
* Semantic class export mode.
* More style controls (borders, backgrounds, typography, shadows, per-axis gap).
* Device tab override indicators & inheritance inspector.
* Component/snippet library.
* Direct code → canvas sync.
* Syntax highlighting in modal.

## 🤝 Contributing

PRs welcome. Keep additions framework-free (vanilla JS + minimal CSS) unless compelling justification. Open an issue first for larger features.

## 📄 License

TBD (to be added).

---
Enjoy building layouts. Feedback & ideas are appreciated!
