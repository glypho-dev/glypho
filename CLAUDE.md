# Glypho - `.g` Format

LLM-optimized graph notation format. ~17% token cost vs JSON Canvas.

## Commands

```bash
npm install                              # install all workspaces
npm test                                 # run all workspace tests
npm run build                            # build all packages
npm test --workspace=packages/parser     # parser only
npm test --workspace=packages/renderer   # renderer only
npm test --workspace=packages/cli        # CLI only
npm test --workspace=packages/glypho     # umbrella only
npx glypho --help                        # CLI usage (after build)
```

Build order matters: parser → renderer → cli → glypho (`npm run build` handles this).

## Architecture

| Package | Path | Purpose |
|---------|------|---------|
| `@glypho/parser` | `packages/parser/` | Lexer + recursive descent parser → AST |
| `@glypho/renderer` | `packages/renderer/` | Layout engine + pure SVG renderer + React component |
| `@glypho/cli` | `packages/cli/` | CLI tool: check, parse, info, render, preview, convert |
| `glypho` | `packages/glypho/` | Umbrella package: re-exports parser + renderer |
| Spec | `spec/` | EBNF grammar, specification, examples |

Monorepo uses npm workspaces.

## Key Exports

**Parser** (`@glypho/parser`):
- `parse(input): ParseResult` — main entry point
- `parseMermaid(input): ParseResult` — Mermaid flowchart → AST
- `parseDot(input): ParseResult` — Graphviz DOT → AST
- `graphToMermaid(graph)`, `graphToGlypho(graph)`, `graphToDot(graph)`, `graphToJsonCanvas(graph)` — serializers
- `flattenGroups(groups)` — recursively flatten nested groups
- Types: `Graph`, `Node`, `Edge`, `Group`, `Position`, `Style`, `Direction`, `Shape`, `EdgeOp`

**Renderer** (`@glypho/renderer`):
- Two entry points:
  - `@glypho/renderer` — full API including React component (requires React peer dep)
  - `@glypho/renderer/svg` — pure SVG string renderer (no React/DOM dependency)
- `render(source, options?): { svg, errors }` — `.g` text in → SVG string out (no React)
- `renderSvg(graph, options?): string` — Graph AST → SVG string (no React)
- `RenderSvgOptions`: `{ width?, height?, padding? }`
- `<GlyphoGraph graph={graph} />` — React component (SVG output, `onNodeClick`, `onEdgeClick`)
- `GlyphoGraphProps`: `{ graph, width?, height?, padding?, className?, style?, onNodeClick?, onEdgeClick? }`
- `computeLayout(graph): LayoutResult` — dagre-based auto-layout
- Types: `LayoutNode`, `LayoutEdge`, `LayoutGroup`, `LayoutResult`, `Point`, `EdgeLabelBox`, `NodeStyle`
- Utilities: `measureNode`, `measureText`, `measureLine`, `measureEdgeLabel`, `wrapLabel`, `LINE_HEIGHT`, `MAX_LABEL_WIDTH`, `resolveNodeStyle`, `resolveEdgeColor`
- The root entry re-exports everything in `/svg` (including `render`/`renderSvg`); `typesVersions` maps `/svg` types for `moduleResolution: node10`

**Umbrella** (`glypho`):
- Two entry points:
  - `glypho` — parser + SVG renderer (no React dependency)
  - `glypho/react` — adds `GlyphoGraph` React component
- Re-exports all parser and renderer APIs — `import { parse, render } from 'glypho'`
- CLI remains a separate package: install `@glypho/cli` for the `glypho` command

**CLI** (`@glypho/cli` → `glypho` command):
- Subcommands: `check`, `parse`, `info`, `render`, `preview`, `to mermaid`, `from mermaid|dot`
- All commands except `preview` accept `-` for stdin or read from stdin when piped (`preview` requires an existing `.svg` file)
- `render` always writes a file (output path derived from input name unless `-o` given) — it never prints SVG to stdout; the format follows the `-o` extension, missing directories are created, and it refuses to overwrite its input
- Input format is detected by extension (`.mmd`/`.mermaid`, `.dot`/`.gv`); stdin is `.g` unless `--from mermaid|dot` is given
- Expected failures throw `CliError` (`packages/cli/src/lib/errors.ts`); `index.ts` prints `error: <msg>` without a stack and exits 1
- See `glypho --help` or README for full CLI reference

## Format Quick Reference

- **Directions**: `>LR`, `>TB`, `>RL`, `>BT`
- **Shapes**: `r` rect, `d` diamond, `c` circle, `o` oval, `p` pill, `h` hexagon
- **Edges**: `>` flow, `~` dashed, `=` thick, `--` undirected, `<>` bidirectional
- **Groups**: `@name{node1 node2}` (supports nesting: `@outer{@inner{a b} c}`)
- **Classes**: `.cls{a b}` membership, `$.cls{fill:#f00}` class styles
- **Positions**: `node@x,y^wxh`
- **Styles**: `$:r{fill:#fff}`

**Parser is strict** — these are loud, line-anchored errors, not silent fixes: multi-word bare labels (must quote), labels on chains (`a>b>c label`), unquoted non-ASCII text, invalid hex colors (3 or 6 digits only), negative coordinates, duplicate node definitions, trailing junk after any statement. Lexer errors surface through `parse()` alongside parser errors, sorted by position.

## Key Rules

1. Grammar changes → update `spec/grammar.ebnf`, `spec/specification.md`, and `packages/parser/src/types.ts`
2. All parser changes need tests
3. Renderer: layout engine and SVG string emitter are pure (no DOM); React component is a thin wrapper. PNG rasterization lives in the CLI (resvg) — the renderer packages emit SVG only
4. Renderer output changes must regenerate the SVG file snapshots (`packages/renderer/tests/__snapshots__/examples/`): `npm test --workspace=packages/renderer -- -u`, then eyeball the changed `.svg` files before committing
5. SVG string renderer must escape all user-derived values via `escapeXml()` (labels, style properties, colors); marker IDs derived from colors must be sanitized with `isValidHex()` to prevent SVG injection
6. Full spec: `spec/specification.md`

## Public Repository

This repo is public and open source. Before every commit and push, review the full staged diff for secrets (keys, tokens, passwords, `.env`), personal data (personal emails, real names, phone numbers) and machine-specific details (absolute local paths like `/Users/...` or `/private/tmp/...`, hostnames, private URLs — including inside generated SVG snapshots, fixtures and logs). Commit with the GitHub noreply address only. If something sensitive is already committed, stop and tell the user before pushing. Checklist and grep command: see AGENTS.md → Public Repository.
