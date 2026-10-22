# Session and data handling

- Connect only to a loopback CDP endpoint. Do not expose the debugging port to a network.
- Authenticate manually in the controlled browser; do not paste credentials into issues or logs.
- Cookies remain in the browser. This CLI does not export browser storage or save credentials.
- Snapshots, uploaded-asset maps, and backups can contain private article content. They are ignored by Git and should remain local.
- `create-article` accepts only existing relative asset files inside `--assets`. Absolute paths, traversal, sibling-prefix escapes, and symlinks resolving outside the asset directory are rejected before upload.
- Only invoke edits authorized by the account owner. Server authorization errors are authoritative.
- A stale snapshot is rejected. Re-read the document and reapply the intended change instead of forcing a save.
- The tool has no publish, send, account-management, permission-change, or delete command.
- Use a separate draft for experiments. Article creation uploads assets before creating the draft; an interrupted run can leave uploaded assets or a created draft. Inspect the account before repeating a write.
- This is an unofficial integration. Frontend service names and document schemas may change.

Report vulnerabilities privately through GitHub's private vulnerability reporting when enabled. Do not include session tokens, credentials, or private drafts in public reports.
