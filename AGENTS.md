# Xiumi editing workflow

Use `node xiumi.mjs help` and the commands in README.md to edit authorized Xiumi drafts. Keep the controlled BB Browser session on an authenticated `https://xiumi.us/studio/v5` page. Never export cookies or credentials.

Read a fresh snapshot before structural edits. Preserve its `showId` and `savedAt`, edit only requested fields, and save through `update`. The CLI creates a backup and rejects stale revisions. After saving, read the draft again and verify the requested content. For visual edits, open the returned draft URL and check actual rendering and image load state.

Create a separate test draft when validating new write behavior. Publishing, account/permission changes, membership changes, and deletion are outside this bridge's scope. Treat server authorization errors as authoritative. Do not invoke the VIP HTML importer or modify entitlement checks.

Run `node --test` after library changes and `node --check` for changed JavaScript files. Record only verified results in README.md. Do not claim lower-level accounts are supported based solely on tests run on a member account.
