# Glypho - `.g` Format

LLM-optimized graph notation format. ~20% token cost vs JSON Canvas.

## Commands

```bash
npm install                              # install all workspaces
npm test                                 # run all workspace tests
npm run build                            # build all packages
npm test --workspace=packages/parser     # parser only
npm test --workspace=packages/renderer   # renderer only
npm test --workspace=packages/cli        # CLI only
node packages/cli/dist/index.js --help   # CLI usage (after build)
```

Build order matters: parser → renderer → cli (`npm run build` handles this).

## Architecture

| Package | Path | Purpose |
|---------|------|---------|
| `@glypho/parser` | `packages/parser/` | Lexer + recursive descent parser → AST |
| `@glypho/renderer` | `packages/renderer/` | Layout engine + pure SVG renderer + React component |
| `@glypho/cli` | `packages/cli/` | CLI tool: check, parse, info, render, preview, convert |
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
- Types: `LayoutNode`, `LayoutEdge`, `LayoutGroup`, `LayoutResult`, `Point`, `NodeStyle`
- Utilities: `measureNode`, `measureText`, `resolveNodeStyle`, `resolveEdgeColor`, `computeViewBox`

**CLI** (`@glypho/cli` → `glypho` command):
- `glypho check [file]` — validate `.g` files (`--json` for machine output)
- `glypho parse [file]` — print JSON AST (`--compact` for minified)
- `glypho info [file]` — stats + multi-format token comparison (`--json`)
- `glypho render [file]` — render Glypho, Mermaid, or DOT to SVG/PNG (`-f png`, `-o path`, `--width`, `--height`, `--scale`, `-b/--background <color>`)
- `glypho preview <file.svg>` — open an existing SVG in the default browser (`--force` to override CI/non-interactive guard)
- `glypho to mermaid [file]` — convert `.g` to Mermaid text
- `glypho from mermaid|dot [file]` — convert Mermaid or DOT to `.g`
- Commands accept `-` for stdin, and when `[file]` is omitted they read from stdin if input is piped

## Format Quick Reference

- **Directions**: `>LR`, `>TB`, `>RL`, `>BT`
- **Shapes**: `r` rect, `d` diamond, `c` circle, `o` oval, `p` pill, `h` hexagon
- **Edges**: `>` flow, `~` dashed, `=` thick, `--` undirected, `<>` bidirectional
- **Groups**: `@name{node1 node2}` (supports nesting: `@outer{@inner{a b} c}`)
- **Classes**: `.cls{a b}` membership, `$.cls{fill:#f00}` class styles
- **Positions**: `node@x,y^wxh`
- **Styles**: `$:r{fill:#fff}`

## Key Rules

1. Grammar changes → update `spec/grammar.ebnf`, `spec/specification.md`, and `packages/parser/src/types.ts`
2. All parser changes need tests
3. Renderer: layout engine and SVG string emitter are pure (no DOM); React component is a thin wrapper
4. SVG string renderer must escape all user-derived values via `escapeXml()` (labels, style properties, colors); marker IDs derived from colors must be sanitized with `isValidHex()` to prevent SVG injection
5. Full spec: `spec/specification.md`
