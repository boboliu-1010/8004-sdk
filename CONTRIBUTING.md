# Contributing

Thank you for contributing to the 8004 SDK.

## Development workflow

1. Fork or clone the repository and add the upstream remote.
2. Synchronize `develop`.
3. Create `feature/<short-description>` from `develop`.
4. Make a focused change and add or update tests and documentation.
5. Open a pull request to `develop`.

See [BRANCHING.md](./BRANCHING.md) for release and hotfix workflows.

## Checks

Run the checks for every SDK affected by the change.

TypeScript:

```bash
cd ts
npm ci
npm test
npm run build
```

Python:

```bash
cd python
python -m pip install -e '.[dev]'
ruff check .
pytest
```

CI treats pytest exit code 5 as success while no tests are collected. New
behavior should still include tests whenever practical.

## Cross-SDK changes

The TypeScript and Python packages are released at the same version. When an
API is supported by both SDKs, keep behavior, naming, examples, and error
handling aligned or explain the intentional difference in the pull request.

## Versions and changelog

- Do not edit package versions in a normal feature pull request.
- Add user-visible changes to the `Unreleased` section of `CHANGELOG.md`.
- Maintainers update both package versions, `RELEASE_NOTE.md`, and the dated
  changelog section on a `release_vX.Y.Z` or `hotfix/*` branch.

Never commit private keys, seed phrases, access tokens, or production
credentials. Use documented environment variables and non-sensitive test
accounts in examples.

