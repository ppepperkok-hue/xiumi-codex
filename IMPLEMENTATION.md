# Xiumi editing bridge

Use the browser session on the BB Browser CDP endpoint to invoke Xiumi's ordinary authenticated editing services. Credentials remain in the browser. No authentication state is exported. No Codex or browser configuration is modified.

Acceptance: authenticate, read an owned draft, create a separate draft, update it with optimistic concurrency, read it back, upload a local image, and verify the saved result in the editor. Provide a reusable CLI and meaningful failure tests.

The bridge supports native document editing, not the paid HTML-code importer. It does not call `/api/htmlCode/verify`, alter membership, publish articles, send articles to other users, or delete content. Account permissions and server limits remain authoritative.

Before an update, persist a local snapshot and require its `savedAt` revision to match the current remote document. The existing application service adds the server's `lastSavedAt`, signing, and compression fields. Authentication failure, conflicts, and service errors must be visible to the caller.
