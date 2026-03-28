# Changelog

All notable changes to the Glypho packages will be documented in this file.

All packages (`@glypho/parser`, `@glypho/renderer`, `@glypho/cli`) are versioned in lockstep.

## 0.1.2 — Security Fix & React Component Parity

### @glypho/renderer

- **Security**: Fix SVG markup injection via marker IDs derived from user-provided color values. Marker IDs are now index-based, and color validation rejects non-hex input with a safe fallback. Affects the SVG string renderer only; the React component was not exploitable.
- Fix arrowhead stroke bleed fix now applied to React component path (was only in SVG string renderer)
- Share edge path shortening logic between SVG string renderer and React component
- Add visual test page (`test-visual.html`) for verifying React component rendering
- Update README embedding examples with safety guidance for `innerHTML` usage

---

## 0.1.1 — Bug Fixes & Rendering Improvements

### @glypho/renderer

- Fix arrowhead color now matches edge color
- Fix edge stroke no longer bleeds past arrowhead tip
- Fix edge paths and labels included in viewBox bounds calculation

### @glypho/cli

- Add `--background` / `-b` flag to `render` command (SVG default: transparent, PNG default: white)
- Fix SVG background rect uses viewBox coordinates correctly

### Spec

- Fix comment constraint to match end-of-line comment support

---

## 0.1.0 — Initial Release

First public release of the `.g` format toolchain.

### @glypho/parser

- Lexer and recursive-descent parser producing a typed AST
- Six node shapes: rect, diamond, circle, oval, pill, hexagon
- Five edge types: flow (`>`), dashed (`~`), thick (`=`), undirected (`--`), bidirectional (`<>`)
- Edge labels and chain syntax (`a>b>c`)
- Groups with nesting (`@outer{@inner{a b} c}`)
- Class membership (`.cls{a b}`) and class style definitions (`$.cls{fill:#f00}`)
- Explicit positions (`node@x,y^wxh`) and inline styles (`$:r{fill:#fff}`)
- Layout directions: LR, TB, RL, BT
- Error recovery — parser continues past errors and reports all issues
- Mermaid flowchart import (`parseMermaid`) and DOT import (`parseDot`)
- Serializers: `graphToMermaid`, `graphToGlypho`, `graphToDot`, `graphToJsonCanvas`

### @glypho/renderer

- Dagre-based auto-layout engine
- Pure SVG string renderer (`@glypho/renderer/svg`) — no React or DOM required
- React component (`<GlyphoGraph>`) with click handlers
- All six shapes rendered with proper SVG paths
- Edge routing with arrow markers, labels, and curve types
- Group rendering with background regions
- Style and class application

### @glypho/cli

- `glypho check` — validate `.g` files with `--json` machine output
- `glypho parse` — print JSON AST with `--compact` option
- `glypho info` — stats and multi-format token comparison
- `glypho render` — render `.g`, Mermaid, or DOT to SVG or PNG
- `glypho preview` — open an existing SVG in the default browser
- `glypho to mermaid` — convert `.g` to Mermaid flowchart
- `glypho from mermaid|dot` — convert Mermaid or DOT to `.g`
- All commands support stdin piping

### Stability

This is a pre-1.0 release. The `.g` format grammar and public APIs may change based on feedback. The spec is versioned as `1.0.0-draft`.
