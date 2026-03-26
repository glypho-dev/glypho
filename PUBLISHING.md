# Publishing Policy

This document defines the current publishing policy for the `@glypho/*` npm packages.

## Current Policy

Glypho currently publishes these three packages together:

- `@glypho/parser`
- `@glypho/renderer`
- `@glypho/cli`

Even though these are separate npm packages, they are tightly coupled:

- `@glypho/renderer` depends on `@glypho/parser`
- `@glypho/cli` depends on `@glypho/parser`
- `@glypho/cli` depends on `@glypho/renderer`

Because of that, the current policy is:

1. Use lockstep versioning.
2. Keep all three packages on the same version.
3. Publish all three packages together.
4. Publish in dependency order: parser, then renderer, then cli.
5. Manage versions manually for now, since this is still a small solo-maintained repo.

This policy can change later if the packages become more independent.

## Versioning

The version users see on npm comes from the `version` field in each package's own `package.json`.

For this repo:

- `packages/parser/package.json`
- `packages/renderer/package.json`
- `packages/cli/package.json`

GitHub tags and releases do not control the npm package version. They are optional markers only.

## Release Strategy

Current strategy:

1. Start from `0.1.0` for the first public release.
2. Stay below `1.0.0` while the public API is still evolving.
3. Bump all three packages together.

Suggested bump rules:

- Patch release: `0.1.0` -> `0.1.1` for bug fixes and small corrections
- Minor release: `0.1.0` -> `0.2.0` for new features or meaningful improvements
- Pre-1.0 breaking change: `0.2.0` -> `0.3.0` for bigger incompatible changes before stability
- Stable release: move to `1.0.0` once the public surface is intentionally stable

## Manual Release Checklist

Before publishing:

1. Update the version in all three package manifests.
2. Update internal dependency versions so they match the new lockstep version.
3. Confirm package READMEs are ready for npm users.
4. Run the full repo test suite.
5. Run the full repo build.
6. Review the git worktree and publish from a clean state.

Publishing order:

1. Publish `@glypho/parser`
2. Publish `@glypho/renderer`
3. Publish `@glypho/cli`

After publishing:

1. Verify each package/version on npm.
2. Optionally create a matching git tag or GitHub release.

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

1. Verifies all three package versions match.
2. Verifies internal dependency versions match the same lockstep version.
3. Refuses to publish from a dirty git worktree.
4. Runs `npm test`.
5. Runs `npm run build`.
6. Publishes parser, then renderer, then cli.

## When To Revisit This Policy

Switch away from manual lockstep versioning if one or more of these becomes true:

- packages start shipping on clearly different schedules
- version coordination becomes error-prone
- publishing starts to feel repetitive or risky
- changelog and release tracking become hard to manage manually

If that happens, adopt a release tool such as Changesets.
