## Summary

<!-- What changed and why? -->

## Branch routing

- [ ] Normal work uses `feature/* -> develop`.
- [ ] Release work uses `release_vX.Y.Z -> main`.
- [ ] Hotfix work uses `hotfix/* -> main`.

## Validation

- [ ] TypeScript tests and build pass, or TypeScript is not affected.
- [ ] Python lint and tests pass, or Python is not affected.
- [ ] Cross-SDK API behavior remains aligned, or the difference is documented.
- [ ] Examples and documentation are updated where needed.
- [ ] User-visible changes are recorded under `Unreleased` in `CHANGELOG.md`.
- [ ] No secrets or production credentials are included.

## Release-only checks

<!-- Required only for release and hotfix pull requests. -->

- [ ] `ts/package.json`, `ts/package-lock.json`, and
      `python/pyproject.toml` use the same version.
- [ ] `CHANGELOG.md` and `RELEASE_NOTE.md` describe that version.

