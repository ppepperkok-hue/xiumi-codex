# Observed editor services

This unofficial integration was tested against the publicly shipped Xiumi studio 14.6.6 frontend on 2026-10-17. Endpoint names below describe observed normal editor operations, not a supported public API contract.

| Operation | Request | Application service |
| --- | --- | --- |
| Check login | `GET /auth/me` | `authManager.loadUser()` |
| List drafts | `GET /api/shows` | `showsManager.shows()` |
| Read draft metadata | `GET /api/shows/{id}` | `showsManager.show()` |
| Read native component data | `GET {show_data_url}` | `showsManager.showData()` |
| Create native article | `POST /api/shows/v5/article` | `showsManager.create()` |
| Update draft | `PUT /api/shows/{id}` | `showsManager.update()` |
| Upload a base64 image | `POST /api/assets/image/data` | `imageAPI.uploadImageInBase64()` |

The bridge calls these services in the authenticated page. The application handles payload compression and signatures. Updates retain `lastSavedAt` and `savingToken`; local snapshots additionally require the expected revision. A per-draft write creates a backup before submission.

The paid HTML-code importer uses a separate `/api/htmlCode/verify` workflow. This project does not call that endpoint or change entitlement checks. The article recipe constructs ordinary native text/image components locally and sends them through normal draft editing services.

Live validation covered creating a test draft, replacing its text, saving and reading it back, uploading images, creating a complete article, and reopening it with 11/11 body images loaded. Testing used a member account. Non-member behavior and behavior after membership expiration remain unverified.

No third-party frontend bundle, account metadata, draft ID, screenshot, credential, or private article material is distributed in this repository. All requests remain subject to server authorization and storage limits.
