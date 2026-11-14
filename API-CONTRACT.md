# API contract

All URLs are relative to the same origin. The existing user endpoints are implemented; the admin configuration endpoints below are **proposed and not yet implemented**. The admin page does not pretend changes have succeeded if an endpoint fails.

## Existing user flow

### `GET /user/document-types`

Returns the cached configuration. The frontend expects:

```json
{
  "documents": [
    {
      "documentId": "aadhaar",
      "name": "Aadhaar",
      "required": true,
      "fields": [
        { "key": "name", "label": "Full name", "type": "text", "required": true, "pattern": null, "not_future": false },
        { "key": "number", "label": "Aadhaar number", "type": "text", "required": true, "pattern": "^[0-9]{12}$", "not_future": false },
        { "key": "dob", "label": "Date of birth", "type": "date", "required": true, "pattern": null, "not_future": true }
      ]
    }
  ]
}
```

### `POST /user/submissions`

The user supplies a phone number on each submission; there is no login or OTP. Example request:

```json
{
  "phone": "9876543210",
  "documents": [
    { "documentId": "aadhaar", "fields": { "name": "Example Name", "number": "123456789012", "dob": "1990-01-31" } }
  ]
}
```

The phone number is unverified and can be repeated across submissions. Successful responses contain `{ "status": "saved", "submissionId": 1 }`. Field validation failures return HTTP 400, for example:

```json
{ "error": "Please enter a valid Aadhaar number.", "documentId": "aadhaar", "field_key": "number" }
```

A phone error returns `{ "error": "Enter a valid 10-digit phone number.", "field_key": "phone" }`. Other errors can return `{ "error": "..." }`. The user frontend displays errors beside their fields and presents a final review before submission. Photos remain in the browser; only text is sent.

## Proposed admin configuration API — not implemented

The admin frontend has its own files in `internal/admin/static/`: `admin.html`, `admin.css`, and `admin.js`. The existing admin router serves them at `/admin/static/admin.html`, independently of the user frontend. It sends same-origin JSON requests to the following endpoints. **There is currently no admin login or authorization in this UI or these routes. Do not deploy this page or implement these endpoints without server-side admin authentication, authorization and CSRF protection.** The admin document-list endpoint is separate from the existing public list because it includes `sort_order`.

### `GET /admin/document-types`

Return a list including document display order and fields:

```json
{
  "documents": [
    {
      "documentId": "aadhaar",
      "name": "Aadhaar",
      "required": true,
      "sort_order": 1,
      "fields": [
        { "key": "name", "label": "Full name", "type": "text", "required": true, "pattern": null, "not_future": false }
      ]
    }
  ]
}
```

Use `documents: []` for an empty list. Fields are uniquely identified by their `key` within a document. `pattern` may be `null` or a string; `not_future` should be a boolean. Return document fields in display order.

### `POST /admin/document-types`

```json
{ "id": "passport", "name": "Passport", "required": false, "sort_order": 3 }
```

### `PUT /admin/document-types/{documentId}`

```json
{ "name": "Passport", "required": false, "sort_order": 3 }
```

Document IDs are immutable in the UI. ID rules: lowercase letter first, followed by lowercase letters, numbers, underscores, or hyphens; maximum 50 characters. Return `409` for duplicates or conflicts.

### `DELETE /admin/document-types/{documentId}`

No request body. A document may be referenced by existing submissions (`submission_values.documentId` has a foreign key). Do not silently delete historical submissions; reject with `409` and a useful error when referenced, or design an explicit archival policy. Fields cascade according to the current schema when a document is deleted.

### `POST /admin/document-types/{documentId}/fields`

```json
{ "key": "dob", "label": "Date of birth", "type": "date", "required": true, "pattern": null, "not_future": true }
```

### `PUT /admin/document-types/{documentId}/fields/{field_key}`

```json
{ "label": "Date of birth", "type": "date", "required": true, "pattern": null, "not_future": true }
```

Field keys are immutable in the UI. Key rules: lowercase letter first, followed by lowercase letters, numbers, or underscores; maximum 50 characters. Supported types: `text`, `date`. `not_future` only applies to dates. `pattern` is nullable and should be checked for validity server-side. Patterns should use syntax supported by both Go and JavaScript, since both user frontend and backend validate them.

### `DELETE /admin/document-types/{documentId}/fields/{field_key}`

No request body. Define how previously submitted values are retained and displayed before allowing deletion. The current schema stores field keys as text in historical submission values, so removing a field can leave historical values without a current label; reject or archive as appropriate.

### Common response and behavior

- Successful mutations should return 2xx (a JSON body or `204 No Content`); the UI then fetches the list again. Failed mutations should return a non-2xx status and optionally `{ "error": "Human-readable message" }` or `{ "message": "..." }`. Use 400 for invalid input, 401/403 for access failures, 404 for missing resources, and 409 for conflicts.
- Validate all input and authorization server-side. Treat required-document rules and historical data safety as backend responsibilities, not only UI checks.
- After each successful change, refresh the in-memory document configuration cache (`utils.GetIMCache().Refresh()` or an equivalent reliable mechanism) so `/user/document-types` and submission validation use the updated configuration. Handle cache refresh failures explicitly.
- The schema contains both new column definitions and idempotent `ALTER TABLE` statements for existing databases. Schema edits do not run automatically; apply the migration separately.
