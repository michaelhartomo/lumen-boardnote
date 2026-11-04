# Security Specification & Test Suite

## 1. Data Invariants

1. **Board Invariant**: A board must possess an ID matching `^[a-zA-Z0-9_\-]+$`, a string title of maximum 256 characters, and a valid `updatedAt` timestamp. Unbounded junk fields or oversized document payloads are blocked.
2. **Comment Invariant**: A comment must possess a valid `id`, a string `card_id`, string `text` between 1 and 2000 characters, and a valid `created_at` timestamp.
3. **Activity Log Invariant**: An activity entry must possess a valid `id`, string `board_id`, valid `action_type`, and valid `timestamp`.
4. **Denial-of-Wallet Guard**: String lengths are strictly capped (`id` <= 128 chars, `title` <= 256 chars, `description` <= 5000 chars, `text` <= 2000 chars).
5. **ID Poisoning Guard**: Document ID path variables must match `^[a-zA-Z0-9_\-]+$` and be <= 128 characters.

## 2. The "Dirty Dozen" Payloads

1. **Ghost Field Board Attack**: Attempt to create a board with unauthorized injected property `isSuperAdmin: true`.
2. **Oversized Board Title Attack**: Attempt to create a board with a 50KB string as `title`.
3. **ID Poisoning Attack**: Attempt to write a document with an ID containing path traversal characters like `../../admin`.
4. **Malformed Card Comment Attack**: Attempt to write a comment with no `text` field.
5. **Oversized Comment Attack**: Attempt to write a comment with a 10MB `text` payload.
6. **Activity Log Missing Board Attack**: Attempt to write an activity log missing `board_id`.
7. **Temporal Violation Attack**: Attempt to submit future or corrupted timestamp formats.
8. **Catch-All Probe Attack**: Attempt to write arbitrary documents into `/unauthorized_collection/secret`.
9. **Comment Reaction Poisoning**: Attempt to inject arbitrary script tags into comment reactions.
10. **Board Drawing Injection**: Attempt to push corrupted drawing objects without valid properties.
11. **Negative Coordinate Exploitation**: Attempt to supply invalid coordinate formats that break layout logic.
12. **Unsanitized Card Type Injection**: Attempt to push non-whitelisted card types to bypass rendering controls.

## 3. Test Coverage & Verification Plan

All writes to the catch-all `/{document=**}` return `PERMISSION_DENIED`.
Valid operations on `/boards/{boardId}`, `/boards/{boardId}/activity/{activityId}`, and `/cards/{cardId}/comments/{commentId}` with sanitized IDs and schemas are accepted, while malformed payloads and malicious path variables are rejected.
