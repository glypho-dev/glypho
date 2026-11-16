# Changelog

All notable changes to the Glypho packages will be documented in this file.

All packages (`@glypho/parser`, `@glypho/renderer`, `@glypho/cli`, `glypho`) are versioned in lockstep.

## 0.3.0 — Strict Parser, Denser Labelled Layouts, CLI Hardening

### Breaking

- **Parser**: unknown escapes in quoted strings, such as `"C:\path"`, are now errors. Write `"C:\\path"`.
- **Parser**: bare style values may only contain ASCII letters, digits and `. _ % , + -`. Quote anything else, including non-ASCII text (`$#a{font:"Noto Sans"}`).
- **Parser**: group members and positions that name an undeclared id now create that node, as class assignments already did. Before, they were dropped.
- **CLI**: empty input is an error, so `glypho check` no longer passes on an empty stdin.
- **CLI**: `render` takes its output format from the `-o` extension (`-o out.png` writes PNG) unless `--format` is given, and refuses to overwrite its input file.
- **All packages**: Node.js >=22 is required (`engines`). Node 20 is end-of-life.
- **Renderer**: layouts change for graphs with edge labels. Labels are centred on their edge and sized in the layout, so these graphs are laid out differently and are often slightly larger. Arrowhead marker ids are now `<prefix>-arrowhead…` rather than `arrowhead…`.

### @glypho/parser

- Unterminated strings (`"…` and `"""…`) are line-anchored errors instead of silently swallowing the rest of the file
- Fix backslash at end of file and line counting after escaped newlines
- Style values accept decimals, units and dash lists (`stroke-width:1.5`, `12px`, `5,5`)
- `$#add{…}`-style id selectors no longer lex as hex colors
- Mermaid import: compact arrows (`A-->B`, `C---D`), `A -- label --> B` and `-.->`; only lowercase `end` closes a subgraph; HTML entities are decoded
- Importers rewrite ids that aren't valid `.g` ids (`_start` → `start`, `1` → `n1`) and keep the original as the label; named colors become hex; DOT `1 -> 2` edges are no longer dropped
- `graphToGlypho` quotes labels that wouldn't re-lex (`3D`, `_x`, `a-`, labels containing `"""`), keeps quoted style values and drops non-hex colors
- `graphToDot` quotes non-plain ids and keywords; `graphToMermaid` escapes `&` and `<`
- Deep nesting reports a stack-overflow error instead of crashing
- Every spec example now round-trips through `.g`, Mermaid and DOT in tests

### @glypho/renderer

- `escapeXml` strips XML-invalid control characters that made resvg and strict XML parsers reject the SVG
- Arrowhead marker ids get a per-graph prefix, so two diagrams on one page no longer share arrowhead colors. The default prefix is a hash of the graph, so output stays deterministic; set it with the new `RenderSvgOptions.idPrefix`
- Parallel edges are routed separately instead of overprinting
- Edge labels use the glyph-aware sizer, wrap and honour `\n`; CJK labels no longer overflow and get clipped
- Density: label room is reserved only along the rank axis, and flat labelled graphs are compressed back to normal rank spacing. Across the spec examples, label/node/group collisions drop from 13 to 3
- Empty nested groups get their own slot instead of sitting at (0,0); self-loops on pinned nodes route properly
- `stroke-width` values that are non-numeric or negative fall back to the default instead of emitting `NaN`; large values are clamped to 20
- New exports: `measureEdgeLabel()`, `EdgeLabelBox` type, and `LayoutEdge.labelBox`
- The root entry re-exports `render`/`renderSvg`, and `typesVersions` makes `@glypho/renderer/svg` resolve under `moduleResolution: node10`

### @glypho/cli

- Clean `error: …` messages with exit code 1 instead of stack traces for a missing file, a directory as input, bad PNG options and non-numeric `--width`/`--scale`
- `--from g|mermaid|dot` sets the input format for stdin or unknown extensions; `check` and `info` detect `.mmd`/`.dot` by extension
- `render` creates missing output directories
- `--version` reads `package.json` instead of a hard-coded `0.1.0`

### glypho

- Re-exports the sizing helpers, including `measureEdgeLabel` and `EdgeLabelBox`
- `typesVersions` makes `glypho/react` types resolve under `moduleResolution: node10`

### CI, docs and repo

- CI and publish use `npm ci` against the committed lockfile; the test matrix is Node 22 and 24
- Every `.g` snippet in the READMEs and SKILL.md passes `glypho check`; the README token table is regenerated from `glypho info`
- README images and the hero diagram are re-rendered with the 0.3.0 renderer
- AGENTS.md and CLAUDE.md gain a public-repository checklist (secrets, personal data, local paths) for every commit; `CLAUDE.local.md` is git-ignored

---

## 0.1.4 — Umbrella Package README

### glypho

- Add README for the `glypho` npm package page

---

## 0.1.3 — Umbrella Package & Automated Publishing

### glypho (new)

- New umbrella package: `npm install glypho` gives you the parser + SVG renderer in one install
- Two entry points: `glypho` (parser + SVG, no React) and `glypho/react` (adds GlyphoGraph component)
- Re-exports all public APIs from `@glypho/parser` and `@glypho/renderer`

### CI & Publishing

- Tag-triggered npm publishing via GitHub Actions (`v*` tags)
- Lockstep version verification before publish (all 4 packages must match)
- Tag-to-main-HEAD verification prevents publishing from stale commits
- npm provenance attestation (`--provenance`)
- Pre-release support: versions like `0.2.0-beta.1` publish with `--tag next`
- `npm-publish` environment with required reviewer approval gate
- SHA-pinned GitHub Actions for supply chain security
- Dependabot configured for weekly action updates
- Manual publish script updated with branch and HEAD checks

### @glypho/cli

- Auto-scale PNG resolution based on graph size

---

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
