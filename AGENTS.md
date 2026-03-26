# Glypho Development Guidelines

## Project Structure

```
packages/parser/       @glypho/parser — lexer, AST types, recursive descent parser, converters
  src/lexer.ts         Tokenizer
  src/parser.ts        Recursive descent parser
  src/types.ts         AST type definitions (Direction, Shape, EdgeOp, Node, Edge, etc.)
  src/errors.ts        GlyphoParseError class
  src/mermaid.ts       AST → Mermaid converter
  src/mermaid-to-glypho.ts  Mermaid → AST converter
  src/serialize.ts     AST → .g text
  src/dot.ts           AST → Graphviz DOT
  src/json-canvas.ts   AST → JSON Canvas
  src/dot-to-glypho.ts DOT → AST converter
  src/index.ts         Public API
  tests/               Vitest suite

packages/renderer/     @glypho/renderer — layout engine + SVG renderer
  src/index.ts         Full entry (includes React component, requires React)
  src/svg.ts           Pure entry (@glypho/renderer/svg, no React dependency)
  src/GlyphoGraph.tsx  React component wrapper
  src/svg/             Pure SVG string renderer (render-svg.ts, shapes, edges, nodes, groups, markers, escape)
  src/nodes/           React node/shape components (6 shapes)
  src/edges/           React edge components, path calculation, markers
  src/groups/          React group component
  src/layout/          dagre integration, node sizing, layout types (pure, no React)
  src/styles/          Default styles, cascade resolution (pure, no React)
  tests/               Vitest suite

packages/cli/          @glypho/cli — CLI tool (glypho command)
  src/index.ts         Commander-based CLI entry point
  src/commands/        check, parse, info, render, preview, to/mermaid, from/*
  src/lib/             IO helpers, format detection, SVG/PNG rendering
  tests/               Vitest suite

spec/                  EBNF grammar, specification, example `.g` files
```

## Build & Test

- **Runtime**: Node.js, npm workspaces
- **Test framework**: Vitest
- **TypeScript**: strict mode, all packages
- **Build order**: parser → renderer → cli

```bash
npm test                                 # run all workspace tests
npm test --workspace=packages/parser     # parser only
npm test --workspace=packages/renderer   # renderer only
npm test --workspace=packages/cli        # CLI only
npm run build                            # build all
```

## Coding Style

- TypeScript strict mode throughout
- Parser uses recursive descent (no parser generators)
- Layout engine is pure computation (dagre, no DOM/browser dependency)
- SVG string renderer uses `escapeXml()` for all user-derived attribute values
- React component is a thin wrapper over the layout engine; React is an optional peer dep
- SVG output only (no canvas/WebGL)

## Testing Rules

- All parser changes require tests
- Test files live in `tests/` directories within each package
- Use `vitest` and `describe`/`it`/`expect` patterns
- React component tests use `@testing-library/react` with jsdom
- Pure SVG renderer tests are plain `.test.ts` (no jsdom needed)

## Grammar Changes

Changing the `.g` format requires updating **three** things in sync:
1. `spec/grammar.ebnf` — formal grammar
2. `spec/specification.md` — human-readable spec
3. `packages/parser/src/types.ts` — AST type definitions
