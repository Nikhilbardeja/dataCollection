# Frontend API contract

This is a proposed contract; the backend has not been built yet. The frontend uses relative URLs under `/api/v1`. Serve the API on the same origin or configure a reverse proxy. Requests use JSON. Protected endpoints receive `Authorization: Bearer <accessToken>`. Login and refresh do not receive a Bearer token. Errors should use an appropriate HTTP status and optionally return `{ "message": "A user-friendly error" }`. The page does not claim success if a request fails.

## 1. Create a mobile session

`POST /api/v1/sessions`

```json
{ "mobile": "9876543210" }
```

The number is 10 digits, without +91. On success set the refresh token in a `Secure; HttpOnly; SameSite` cookie and return a 2xx JSON response containing only the access token:
```json
{ "accessToken": "access-token-value" }
```
Associate both tokens with the mobile session on the backend. The browser stores the refresh cookie; JavaScript never reads it. No OTP is requested; **this is not authentication or proof of ownership**. Each user can enter any number. The same mobile number may be used by any number of sessions and submissions. Session expiration and logout policy must be defined by the backend.

## 2. Refresh tokens

`POST /user/refresh/` (exact path; **not** under `/api/v1`)

Request: `POST` with an empty JSON object `{}`. The browser automatically sends the HttpOnly refresh-token cookie (`credentials: "same-origin"`); the frontend does not send the refresh token in JSON or in an Authorization header.

Success response:
```json
{ "accessToken": "new-access-token" }
```
When rotating the refresh token, also set the new HttpOnly cookie in the response. The frontend calls this on page load to restore a session and when a protected request returns HTTP **401**, then retries that request once with the new access token. Concurrent 401s within one page share a refresh request. Return 401 or 403 when the refresh cookie is invalid or expired. Network or server errors do not clear the cookie. Return 401 before performing any action so a retry cannot duplicate a submission. The backend should rotate and invalidate the old refresh token.

## 3. Restore an existing session

`GET /api/v1/sessions/current`

Called on page load after refreshing the access token from the cookie; sent with the Bearer access token. Return `{ "active": true, "mobile": "9876543210" }` for an active session; for no session return `{ "active": false }` or HTTP 401. An active session lets the user proceed without entering their number again, including after a refresh. Session lifetime is controlled by token expiry and backend policy. The response must not include previous submissions.

## 4. Load document configuration

`GET /api/v1/document-types`

Called after session creation and again when starting another submission. No mobile number is sent with this request.

Example success response:
```json
{
  "document_types": [
    {
      "id": "aadhaar",
      "name": "Aadhaar",
      "required": true,
      "fields": [
        { "key": "name", "label": "Full name", "type": "text", "required": true },
        { "key": "number", "label": "Aadhaar number", "type": "text", "required": true },
        { "key": "dob", "label": "Date of birth", "type": "date", "required": true }
      ]
    },
    {
      "id": "pan",
      "name": "PAN",
      "required": false,
      "fields": [
        { "key": "name", "label": "Full name", "type": "text", "required": true },
        { "key": "number", "label": "PAN number", "type": "text", "required": true }
      ]
    }
  ]
}
```
Add Driving Licence and Passport in the same format. Supported input types are `text` and `date`; others render as text. Required fields apply whenever their document is included. Set Aadhaar `required: true` and enforce this on the server. Current OCR fills `name`, `number`, and `dob` keys where available and identifies document types by display name; other fields are manual.

## 5. Submit details

`POST /api/v1/submissions`

Request:
```json
{
  "documents": [
    {
      "document_type_id": "aadhaar",
      "fields": { "name": "Example Name", "number": "123456789012", "dob": "1990-01-31" }
    },
    {
      "document_type_id": "pan",
      "fields": { "name": "Example Name", "number": "ABCDE1234F" }
    }
  ]
}
```
The backend must associate each submission with the mobile number stored in the current session. The number is **not verified** and is not proof of identity or ownership. Do not apply a unique constraint to the mobile number: multiple submissions can use the same number. Only filled optional documents are included. On success return a 2xx JSON response, for example `{ "status": "submitted" }`. The browser clears its entered data and displays success; there is no user-facing retrieval endpoint. Validate all fields and required documents on the server. Do not return ID data in the response.

## Privacy and integration notes

- There are no OTP or mobile-verification API calls. The mobile number is sent during session creation; subsequent protected requests use the Bearer access token. The page permits repeat submissions without re-entering the number and restores an active session on reload by calling `/user/refresh/` and then `GET /sessions/current`. Once the backend expires the session, the user must enter the number again.
- The scanner processes the selected image locally. Images are never included in API requests. Tesseract.js and English OCR data download from third-party CDNs; host and pin these assets yourself for tighter supply-chain and network control. OCR can be inaccurate; users should review fields.
- Use HTTPS, server-side validation, abuse controls, encryption in transit and at rest, retention/deletion policies, and appropriate Aadhaar/legal compliance. The frontend is not a security boundary.
- Admin authentication, record management and super-admin configuration are not implemented yet and need separate authorized APIs and UI.
- Run the static frontend with `python -m http.server 8000` from this folder. API requests fail until the backend or proxy is connected. The static server is for development only.

## Token storage and security

The access token exists only in JavaScript memory and is lost on reload. The refresh token is a backend-set HttpOnly cookie, never stored or read by JavaScript. On reload the frontend attempts refresh to obtain a new access token. Cookie requests use `credentials: "same-origin"`; if frontend and backend are on different origins, configure the correct API URLs, CORS and `credentials: "include"` in the frontend. Cookie `Secure`, `SameSite` and domain/path must match the deployment. HTTPS is required for Secure cookies (local development may need special configuration).

CSRF protection is needed for cookie-authenticated refresh and logout. This client currently sends no CSRF token/header; configure it to match your backend's CSRF scheme before production if required. Changing the mobile number clears the access token in memory; it does not revoke or delete the HttpOnly cookie on the server because no logout endpoint is configured. A successful new login must replace the existing refresh cookie. Coordinate refresh-token rotation across multiple tabs on the backend or add cross-tab coordination: the current single-flight refresh is per page only.
