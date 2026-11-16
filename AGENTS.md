# Glypho Development Guidelines

## Project Structure

npm-workspaces monorepo: `packages/parser` (lexer + recursive descent parser + format converters), `packages/renderer` (layout + SVG), `packages/cli` (Commander CLI), `packages/glypho` (umbrella re-exports), `spec/` (EBNF grammar, specification, example `.g` files).

Non-obvious boundaries:
- Renderer has two entry points: `src/index.ts` (React, requires peer dep) and `src/svg.ts` → `@glypho/renderer/svg` (pure, no React/DOM). Umbrella mirrors this: `glypho` (pure) and `glypho/react`.
- Inside renderer, `src/layout/` and `src/styles/` are pure and shared by both the React components (`src/nodes|edges|groups`) and the SVG string emitter (`src/svg/`).

## Build & Test

- **Runtime**: Node.js, npm workspaces
- **Test framework**: Vitest
- **TypeScript**: strict mode, all packages
- **Build order**: parser → renderer → cli → glypho
- See CLAUDE.md for full command reference

## Coding Style

- TypeScript strict mode throughout
- Parser uses recursive descent (no parser generators)
- Layout engine is pure computation (dagre, no DOM/browser dependency)
- SVG string renderer uses `escapeXml()` for all user-derived attribute values; marker IDs from colors validated with `isValidHex()` to block injection
- React component is a thin wrapper over the layout engine; React is an optional peer dep
- Renderer packages emit SVG only (no canvas/WebGL); PNG rasterization lives in the CLI via resvg (no color-font support — emoji in labels break PNG text runs)

## Testing Rules

- All parser changes require tests
- Test files live in `tests/` or `src/__tests__/` directories within each package
- Use `vitest` and `describe`/`it`/`expect` patterns
- React component tests use `@testing-library/react` with jsdom
- Pure SVG renderer tests are plain `.test.ts` (no jsdom needed)
- Renderer keeps SVG file snapshots of the spec examples (`tests/__snapshots__/examples/*.svg`); intentional visual changes need `npm test --workspace=packages/renderer -- -u` and a visual check of the regenerated files

## Grammar Changes

Changing the `.g` format requires updating **three** things in sync:
1. `spec/grammar.ebnf` — formal grammar
2. `spec/specification.md` — human-readable spec
3. `packages/parser/src/types.ts` — AST type definitions

## Public Repository

This repo is public and open source — everything committed or pushed is world-readable and stays in git history. Before every commit and push, review the full staged diff (including new and untracked files you add) and remove:
- Secrets: API keys, tokens, passwords, private keys, `.env` contents, npm auth config
- Personal data: real names beyond the `saultoresan` handle, personal email addresses, phone numbers
- Machine-specific details: absolute local paths (`/Users/...`, `/home/...`, `/private/tmp/...`), hostnames, internal or private URLs — watch generated files such as SVG snapshots, fixtures and logs
- Private notes, scratch files, or agent/session artifacts not meant for the project

Commit with the GitHub noreply address, never a personal email. A quick check before committing:

```bash
git diff --cached | grep -nEi 'api[_-]?key|secret|token|passw|private key|/Users/|/home/|/private/tmp|@gmail\.|@outlook\.|@yahoo\.'
```

If anything sensitive was already committed, stop and tell the maintainer before pushing — it must be scrubbed from history, not just deleted in a follow-up commit.
