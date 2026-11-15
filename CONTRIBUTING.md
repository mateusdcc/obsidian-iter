# Contributing to Iter

Bug reports, documentation edits, new examples, and pull requests are welcome. Open a [GitHub issue](https://github.com/mateusdcc/obsidian-iter/issues/new/choose) to discuss changes that affect how Iter reads or writes vault data.

## Develop in a test vault

1. Fork and clone the repository, then create a branch from `main`.
2. With Node.js 24 installed, run `npm ci`, `npm test`, and `npm run build`.
3. Copy `main.js`, `manifest.json`, and `styles.css` to `.obsidian/plugins/iter/` in a separate Obsidian vault. Enable Iter in that vault.
4. After each change, rebuild, copy the files again, then reload Obsidian. Exercise the relevant flow with fresh data and, for storage changes, with notes made by a previous release.

The plugin entry point is `src/plugin.js`. Vault writes are in `src/storage.js` and `src/data-model.js`. The dashboard and UI files are in `src/`, and Node tests with Obsidian mocks are in `test/`.

Commit the rebuilt `main.js` alongside any change that affects the bundle. GitHub Actions runs the tests and checks that the tracked bundle matches a clean build. In your PR, describe the user-visible change, what you tested, and any effect on existing notes. Screenshots help with UI changes. Use sample data in screenshots and attachments.

## Edit the website

The [`gh-pages` branch](https://github.com/mateusdcc/obsidian-iter/tree/gh-pages) holds the static GitHub Pages site. Branch from `gh-pages` and open documentation PRs against that branch. From the root of that checkout, run `python3 -m http.server 8000` and visit `http://localhost:8000` to preview it.

## Publish a release

1. Update `manifest.json`, `package.json`, and `package-lock.json` to the same version. Review the minimum supported Obsidian version in the manifest and installation docs.
2. Run `npm ci`, `npm test`, and `npm run build`. Test the build in a separate Obsidian vault and push the release commit to `main`.
3. Create a GitHub release whose tag exactly matches the manifest version (for example, `0.1.0`). Attach `main.js`, `manifest.json`, and `styles.css` as individual release assets. BRAT uses those assets to install the plugin.
4. Install or update from the published release with BRAT in a test vault.
