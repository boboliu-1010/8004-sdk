# Branching and Release Workflow

This repository uses `develop` for integration and `main` for stable,
published SDK releases.

## Branch roles

| Branch | Purpose | Merge target |
| --- | --- | --- |
| `main` | Stable source corresponding to published releases | — |
| `develop` | Integration branch for the next release | `main` through a release branch |
| `feature/*` | Normal features, fixes, tests, and documentation | `develop` |
| `release_vX.Y.Z` | Release stabilization and version preparation | `main`, then back to `develop` |
| `hotfix/*` | Urgent fixes based on the current production release | `main`, then back to `develop` |

Do not push directly to `main` or `develop`.

## Normal development

1. Synchronize the local `develop` branch.
2. Create `feature/<short-description>` from `develop`.
3. Implement and test the change.
4. Open a pull request from `feature/*` to `develop`.
5. Record user-visible changes under `Unreleased` in `CHANGELOG.md`.

Normal feature pull requests must not change released version fields.

## Release

1. Create `release_vX.Y.Z` from `develop`.
2. On that branch, prepare only release-related changes:
   - set the same version in `ts/package.json`, `ts/package-lock.json`, and
     `python/pyproject.toml`;
   - move the relevant `CHANGELOG.md` entries from `Unreleased` into a dated
     `X.Y.Z` section;
   - update `RELEASE_NOTE.md`;
   - make stabilization fixes required for the release.
3. Run the TypeScript and Python checks:

   ```bash
   cd ts
   npm ci
   npm test
   npm run build

   cd ../python
   python -m pip install -e '.[dev]'
   ruff check .
   pytest
   ```

   A pytest exit code of 5 is acceptable only while the package has no
   collected tests, matching CI behavior.
4. Open a pull request from `release_vX.Y.Z` to `main`.
5. After merge, create and push tag `vX.Y.Z`, then create the GitHub release.
   The current GitHub workflow publishes the TypeScript package to npm from the
   GitHub release. Maintainers must publish and verify any other configured
   package channel separately.
6. Merge the same release branch back into `develop`. Keep the branch until
   that back-merge is complete so the branch-policy check can validate it.

Version changes happen in step 2, not in ordinary feature pull requests.

## Hotfix

1. Create `hotfix/<short-description>` from `main`.
2. Apply the smallest safe fix and prepare a patch version using the same
   version, changelog, release-note, and test steps as a normal release.
3. Open the hotfix pull request to `main`.
4. After merge, tag and publish the patch release.
5. Merge the hotfix branch back into `develop`.

## Repository settings

Configure GitHub after the branches and workflows are pushed:

- Set `develop` as the default branch.
- Protect `develop` and `main`; require pull requests and passing checks.
- Require the `Branch policy`, `TS SDK`, and `Python SDK` checks.
- Restrict direct pushes and force pushes.
- Keep automatic Audit disabled by leaving `AUDIT_AUTO_ENABLED` unset or set
  to a value other than `true`. The `/audit-pr` command remains available
  to users listed in `AUDIT_ALLOWED_USERS`.

