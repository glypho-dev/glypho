#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Avoid broken user-level npm caches from blocking pack/publish commands.
: "${npm_config_cache:=${TMPDIR:-/tmp}/glypho-npm-cache}"
export npm_config_cache
mkdir -p "$npm_config_cache"

DRY_RUN=0
NPM_TAG="latest"

usage() {
  cat <<'EOF'
Usage: bash scripts/publish-packages.sh [--dry-run] [--tag <tag>]

Publishes the Glypho npm packages in dependency order:
  1. @glypho/parser
  2. @glypho/renderer
  3. @glypho/cli
  4. glypho (umbrella)

Options:
  --dry-run    Run npm publish in dry-run mode
  --tag <tag>  Publish using a specific npm dist-tag (default: latest)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --tag)
      if [[ $# -lt 2 ]]; then
        echo "error: --tag requires a value" >&2
        exit 1
      fi
      NPM_TAG="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "error: unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

read_json_field() {
  local file="$1"
  local expr="$2"
  node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
const value = ${expr};
if (value === undefined) process.exit(2);
process.stdout.write(String(value));
" "$file"
}

PARSER_PKG="packages/parser/package.json"
RENDERER_PKG="packages/renderer/package.json"
CLI_PKG="packages/cli/package.json"
GLYPHO_PKG="packages/glypho/package.json"

PARSER_VERSION="$(read_json_field "$PARSER_PKG" 'data.version')"
RENDERER_VERSION="$(read_json_field "$RENDERER_PKG" 'data.version')"
CLI_VERSION="$(read_json_field "$CLI_PKG" 'data.version')"
GLYPHO_VERSION="$(read_json_field "$GLYPHO_PKG" 'data.version')"

if [[ "$PARSER_VERSION" != "$RENDERER_VERSION" || "$PARSER_VERSION" != "$CLI_VERSION" || "$PARSER_VERSION" != "$GLYPHO_VERSION" ]]; then
  echo "error: package versions are not in lockstep" >&2
  echo "  parser:   $PARSER_VERSION" >&2
  echo "  renderer: $RENDERER_VERSION" >&2
  echo "  cli:      $CLI_VERSION" >&2
  echo "  glypho:   $GLYPHO_VERSION" >&2
  exit 1
fi

LOCKSTEP_VERSION="$PARSER_VERSION"
RENDERER_PARSER_DEP="$(read_json_field "$RENDERER_PKG" "data.dependencies['@glypho/parser']")"
CLI_PARSER_DEP="$(read_json_field "$CLI_PKG" "data.dependencies['@glypho/parser']")"
CLI_RENDERER_DEP="$(read_json_field "$CLI_PKG" "data.dependencies['@glypho/renderer']")"

if [[ "$RENDERER_PARSER_DEP" != "$LOCKSTEP_VERSION" ]]; then
  echo "error: packages/renderer/package.json depends on @glypho/parser@$RENDERER_PARSER_DEP, expected $LOCKSTEP_VERSION" >&2
  exit 1
fi

if [[ "$CLI_PARSER_DEP" != "$LOCKSTEP_VERSION" ]]; then
  echo "error: packages/cli/package.json depends on @glypho/parser@$CLI_PARSER_DEP, expected $LOCKSTEP_VERSION" >&2
  exit 1
fi

if [[ "$CLI_RENDERER_DEP" != "$LOCKSTEP_VERSION" ]]; then
  echo "error: packages/cli/package.json depends on @glypho/renderer@$CLI_RENDERER_DEP, expected $LOCKSTEP_VERSION" >&2
  exit 1
fi

GLYPHO_PARSER_DEP="$(read_json_field "$GLYPHO_PKG" "data.dependencies['@glypho/parser']")"
GLYPHO_RENDERER_DEP="$(read_json_field "$GLYPHO_PKG" "data.dependencies['@glypho/renderer']")"

if [[ "$GLYPHO_PARSER_DEP" != "$LOCKSTEP_VERSION" ]]; then
  echo "error: packages/glypho/package.json depends on @glypho/parser@$GLYPHO_PARSER_DEP, expected $LOCKSTEP_VERSION" >&2
  exit 1
fi

if [[ "$GLYPHO_RENDERER_DEP" != "$LOCKSTEP_VERSION" ]]; then
  echo "error: packages/glypho/package.json depends on @glypho/renderer@$GLYPHO_RENDERER_DEP, expected $LOCKSTEP_VERSION" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "error: git worktree is dirty; commit or stash changes before publishing" >&2
  exit 1
fi

echo "Publishing Glypho packages at version $LOCKSTEP_VERSION"
echo "npm dist-tag: $NPM_TAG"
if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "mode: dry-run"
fi

echo "Running tests..."
npm test

echo "Running build..."
npm run build

publish_workspace() {
  local workspace="$1"
  local package_name="$2"

  echo "Publishing $package_name from $workspace..."
  if [[ "$DRY_RUN" -eq 1 ]]; then
    npm publish --workspace="$workspace" --access public --tag "$NPM_TAG" --auth-type=web --dry-run
  else
    npm publish --workspace="$workspace" --access public --tag "$NPM_TAG" --auth-type=web
  fi
}

publish_workspace "packages/parser" "@glypho/parser"
publish_workspace "packages/renderer" "@glypho/renderer"
publish_workspace "packages/cli" "@glypho/cli"
publish_workspace "packages/glypho" "glypho"

echo "Done."
