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
4. Upgrades npm to a version that supports trusted publishing (Node 22 bundles npm 10).
5. Publishes in dependency order: parser → renderer → cli → glypho, authenticating with npm trusted publishing (OIDC). No npm token is stored in GitHub.
6. Uses `--provenance` for npm attestation.
7. Detects pre-release versions (e.g., `0.2.0-beta.1`) and publishes with `--tag next`.

**Prerequisites**:
- Each of the four packages has a trusted publisher on npmjs.com that matches this workflow (see [Trusted Publishing Setup](#trusted-publishing-setup-one-time) below).
- Protect the `npm-publish` environment with required reviewers if you want a human approval gate before publish.
- Restrict the `npm-publish` environment deployment to `v*` tags (not branches — the workflow is triggered by tag pushes, which GitHub does not treat as branch refs).

**Step-by-step release flow**:

1. Bump versions in all four `package.json` files and internal dependency versions.
2. Commit, open PR, merge to `main` (CI must pass).
3. Pull main locally: `git checkout main && git pull`
4. Tag: `git tag v0.x.x && git push origin v0.x.x`
5. Approve the `npm-publish` environment gate in GitHub Actions.
6. Verify packages on npm: `npm view glypho@0.x.x version`
7. Create a GitHub Release: `gh release create v0.x.x --title "v0.x.x" --notes "..."`

## Required GitHub Configuration

Before relying on automated publishing, configure GitHub so the workflow assumptions are true:

1. Protect the `main` branch.
2. Require pull requests before merge.
3. Require CI status checks to pass before merge.
4. Block force-pushes and branch deletion on `main`.
5. Create an `npm-publish` environment. It needs no secrets: npm authenticates the workflow through OIDC.
6. Restrict the environment deployment to `v*` tags.
7. Optionally require reviewers for the environment to add a manual approval gate.

## Trusted Publishing Setup (one time)

The publish workflow authenticates to npm with [trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC) instead of a long-lived token. Trusted publishing needs npm 11.5.1 or later and Node 22.14.0 or later, and only works on GitHub-hosted runners. The workflow upgrades npm itself and keeps the `id-token: write` permission it needs.

A maintainer of the packages sets this up once on npmjs.com, for **each** of the four packages:

- `@glypho/parser`
- `@glypho/renderer`
- `@glypho/cli`
- `glypho`

For each package:

1. Sign in to npmjs.com and open the package's **Settings** page.
2. Under **Trusted Publisher**, choose **GitHub Actions**.
3. Fill in exactly:

   | Field | Value |
   |-------|-------|
   | Organization or user | `glypho-dev` |
   | Repository | `glypho` |
   | Workflow filename | `publish.yml` (filename only, not the path) |
   | Environment name | `npm-publish` |

4. Under **Allowed actions**, allow direct publishing with `npm publish`. The workflow runs plain `npm publish`, not `npm stage publish`. It sets the `latest`/`next` dist-tag as part of the publish, so `npm dist-tag` access is not needed.
5. Save.

Things to know:

- npm does not validate these fields on save. A typo only shows up as a failed publish. An existing trusted publisher cannot be edited, so delete it and add it again.
- A newly created trusted publisher must complete its first successful publish within 2 days, or it expires. Set up all four packages shortly before tagging the first release that uses trusted publishing. If the window passes, delete and re-add them.

### Retiring the npm token

Until the first release succeeds through trusted publishing, keep the existing `NPM_TOKEN` secret in the `npm-publish` environment, so that reverting to token-based publishing stays possible.

After the first release has published all four packages through OIDC (check that each new version on npmjs.com shows provenance from GitHub Actions):

1. Delete the npm token on npmjs.com (**Access Tokens**).
2. Remove the `NPM_TOKEN` secret from the `npm-publish` environment in GitHub.

Optionally, harden each package afterwards. In the package's **Settings → Publishing access**, choose **Require two-factor authentication and disallow tokens**. Trusted publishers keep working because they use OIDC. All token-based publishing is then blocked, so a manual publish with the helper script needs an interactive login with 2FA.

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
2. Create a GitHub Release for the tag: `gh release create v0.x.x --title "v0.x.x" --notes "..."`

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
