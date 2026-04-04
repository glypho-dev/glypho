# Publishing Policy

This document defines the current publishing policy for the `@glypho/*` npm packages.

## Current Policy

Glypho currently publishes these four packages together:

- `@glypho/parser`
- `@glypho/renderer`
- `@glypho/cli`
- `glypho` (umbrella — re-exports parser + renderer)

Even though these are separate npm packages, they are tightly coupled:

- `@glypho/renderer` depends on `@glypho/parser`
- `@glypho/cli` depends on `@glypho/parser` and `@glypho/renderer`
- `glypho` depends on `@glypho/parser` and `@glypho/renderer`

Because of that, the current policy is:

1. Use lockstep versioning.
2. Keep all four packages on the same version.
3. Publish all four packages together.
4. Publish in dependency order: parser, then renderer, then cli, then glypho.
5. Automated publishing via GitHub Actions on `v*` tags, with manual fallback script.

This policy can change later if the packages become more independent.

## Versioning

The version users see on npm comes from the `version` field in each package's own `package.json`.

For this repo:

- `packages/parser/package.json`
- `packages/renderer/package.json`
- `packages/cli/package.json`
- `packages/glypho/package.json`

GitHub tags trigger automated publishing. The tag version must match the package versions.

## Release Strategy

Current strategy:

1. Start from `0.1.0` for the first public release.
2. Stay below `1.0.0` while the public API is still evolving.
3. Bump all four packages together.

Suggested bump rules:

- Patch release: `0.1.0` -> `0.1.1` for bug fixes and small corrections
- Minor release: `0.1.0` -> `0.2.0` for new features or meaningful improvements
- Pre-1.0 breaking change: `0.2.0` -> `0.3.0` for bigger incompatible changes before stability
- Stable release: move to `1.0.0` once the public surface is intentionally stable

## Automated Publishing (GitHub Actions)

Pushing a version tag triggers the publish workflow:

```bash
git tag v0.2.0
git push origin v0.2.0
```

The workflow (`.github/workflows/publish.yml`):
1. Verifies the tag version matches the package versions.
2. Verifies the tag points at the current `main` branch HEAD.
3. Builds and tests all packages.
4. Publishes in dependency order: parser → renderer → cli → glypho.
5. Uses `--provenance` for npm attestation.
6. Detects pre-release versions (e.g., `0.2.0-beta.1`) and publishes with `--tag next`.

**Prerequisites**:
- An `NPM_TOKEN` secret must be configured for the `npm-publish` GitHub Actions environment (npm automation token with publish access to `@glypho` scope and `glypho` package).
- Protect the `npm-publish` environment with required reviewers if you want a human approval gate before publish.
- Restrict the `npm-publish` environment to the `main` branch only.
- Do not keep `NPM_TOKEN` as a broad repository secret when the environment secret is sufficient.

## Required GitHub Configuration

Before relying on automated publishing, configure GitHub so the workflow assumptions are true:

1. Protect the `main` branch.
2. Require pull requests before merge.
3. Require CI status checks to pass before merge.
4. Block force-pushes and branch deletion on `main`.
5. Create an `npm-publish` environment.
6. Store `NPM_TOKEN` in that environment.
7. Restrict the environment to `main`.
8. Optionally require reviewers for the environment to add a manual approval gate.

## Manual Release Checklist

Before publishing:

1. Update the version in all four package manifests.
2. Update internal dependency versions so they match the new lockstep version.
3. Confirm package READMEs are ready for npm users.
4. Merge the release commit to `main`.
5. Run the full repo test suite.
6. Run the full repo build.
7. Review the git worktree and publish from a clean state.

Publishing order:

1. Publish `@glypho/parser`
2. Publish `@glypho/renderer`
3. Publish `@glypho/cli`
4. Publish `glypho`

After publishing:

1. Verify each package/version on npm.
2. Optionally create a GitHub Release for the tag (the tag itself must already exist — it triggers publishing).

## First Publish Notes

These packages use the scoped names `@glypho/*`.

For public scoped npm packages, the first publish should use:

```bash
npm publish --access public
```

The helper script in this repo applies `--access public` automatically.

## Helper Script

This repo includes a helper script that enforces the current publishing policy:

```bash
bash scripts/publish-packages.sh --dry-run
```

When used for a real release:

```bash
bash scripts/publish-packages.sh
```

What the script does:

1. Verifies all four package versions match.
2. Verifies internal dependency versions match the same lockstep version.
3. Refuses to publish from a dirty git worktree.
4. Refuses to publish from any branch other than `main`.
5. Refreshes `origin/main` and refuses to publish unless `HEAD` matches the remote tip.
6. Defaults to the `next` dist-tag for pre-release versions and `latest` otherwise.
7. Runs `npm test`.
8. Runs `npm run build`.
9. Publishes parser, then renderer, then cli, then glypho.

## When To Revisit This Policy

Switch away from manual lockstep versioning if one or more of these becomes true:

- packages start shipping on clearly different schedules
- version coordination becomes error-prone
- publishing starts to feel repetitive or risky
- changelog and release tracking become hard to manage manually

If that happens, adopt a release tool such as Changesets.
