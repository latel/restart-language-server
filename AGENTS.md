# Agent Instructions

- When bumping the extension version (package.json `version`), **also update CHANGELOG.md** with the new version entry and key changes.
- Ensure README/README.zh-CN stay consistent with user-facing behavior when relevant changes are made.
- Keep CI and release workflows in sync with package manager versions defined in package.json (packageManager, engines.node).
- Run `pnpm run lint` and `pnpm run compile` before tagging a release tag `v*`.
