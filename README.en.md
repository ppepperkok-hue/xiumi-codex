<div align="center">

# Xiumi Codex

**Read, edit, upload images, and save Xiumi drafts from Codex.**

[简体中文](README.md) · [English](README.en.md)

[![CI](https://github.com/ppepperkok-hue/xiumi-codex/actions/workflows/ci.yml/badge.svg)](https://github.com/ppepperkok-hue/xiumi-codex/actions/workflows/ci.yml)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22-43853d)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

<!-- moe-counter:start -->
<a href="https://github.com/journey-ad/Moe-Counter"><img src="https://count.getloli.com/get/@ppepperkok-hue.xiumi-codex?theme=asoul" alt="README views" width="360" /></a>
<br /><sub>Image requests, affected by GitHub caching; not unique visitors.</sub>
<!-- moe-counter:end -->

</div>

This unofficial CLI connects Codex to an authenticated local Xiumi editor. It reads native document components and uses ordinary draft/image services to save changes. Text stays editable and uploaded images use hosted storage URLs.

It does not unlock the paid HTML importer, publish, delete, change membership, or export credentials. Live validation used a member account; non-member behavior and behavior after expiration remain unverified.

## Install and connect

Requires Node.js 22+, Chrome, and [BB Browser](https://github.com/epiral/bb-browser).

```bash
git clone https://github.com/ppepperkok-hue/xiumi-codex.git
cd xiumi-codex
npm ci
npm install -g bb-browser
bb-browser tab new https://xiumi.us/studio/v5 --json
```

Log in manually in the controlled Chrome window, then run `node xiumi.mjs status`. Keep the browser and a Xiumi editor tab open. Other browser profiles do not automatically share this login.

Default CDP endpoint: `http://127.0.0.1:9222`; override with `XIUMI_CDP` or `--cdp`. Only loopback HTTP endpoints are accepted. `playwright-core` does not download another browser. `XIUMI_NODE_MODULES` can point to an existing Codex dependency directory.

## Edit

Open this repository as a Codex project and ask Codex to read, edit, save, and reread a specified draft. Or invoke the CLI:

```bash
node xiumi.mjs list --limit 20
# Replace the sample ID with your own.
node xiumi.mjs read --id 123456789 --out artifacts/draft.json
# Edit data, preserving showId and savedAt.
node xiumi.mjs update --file artifacts/draft.json
node xiumi.mjs replace --id 123456789 --from "old text" --to "new text"
node xiumi.mjs read --id 123456789 --out artifacts/reloaded.json
node xiumi.mjs upload --file ./photo.png --out artifacts/uploaded.json
```

Updates save a backup and reject stale revisions. Read the current document and reapply the edit instead of forcing a save. Do not edit the same draft simultaneously in the UI and CLI. Replacement operates within individual HTML text runs; use snapshot editing for structure changes.

Images: PNG, JPEG, GIF, WebP; local maximum 20 MiB per file. Server authorization, validation, and storage limits remain authoritative.

## Create a structured article

Use [examples/content.json](examples/content.json) and provide `brand-header.png`, `activity-hero.png`, the listed photos, `brand-footer.png`, and `cover-wide.png` in an asset directory.

```bash
node xiumi.mjs create-article --content examples/content.json --assets ./my-assets --out artifacts/created.json
```

Asset paths must be relative to and remain inside `--assets`. Absolute paths, traversal, and symlinks resolving outside the directory are rejected before upload.

This uploads assets, builds ordinary native components, creates a new draft, and reads it back. It is a focused recipe, not a general HTML fidelity converter. Uploaded assets are not rolled back after later failures. Inspect your account before retrying an interrupted create.

## Verification and scope

Live Windows validation on 2026-10-17 covered reading, creating, editing, saving, rereading, uploads, and reopening an article with 11/11 body images loaded. Source text and reviewer names were preserved. The account had membership level 4; lower-level accounts were not tested.

```bash
npm run check
npm test
```

CI is configured for Node.js 22 / 24 on Windows / Linux without real account access. Non-Windows authenticated operations remain unverified. See [API observations](docs/api.md) and [session/data handling](docs/security.md).

Service names and schemas may change. Cookies stay in the browser. Private drafts, account data, screenshots, and downloaded frontend bundles are not distributed. Keep snapshots and backups local. Never expose the debugging port publicly.

The header uses a repository-specific [Moe Counter](https://github.com/journey-ad/Moe-Counter) A-SOUL image. It counts image requests, not unique visitors, and depends on the third-party service and GitHub caching.

Code is licensed under [MIT](LICENSE). Third-party service names, artwork, and services remain with their respective owners.
