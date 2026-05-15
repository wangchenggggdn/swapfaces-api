# swapfaces-api

Cloudflare Worker that logs into Swapfaces, fetches account detail, and stores the token plus account fields in D1.

## Endpoints

Base URL examples:

- Local: `http://127.0.0.1:8787`
- Production: `https://api.opengoon.art`

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Liveness probe. Returns **204 No Content** (no JSON body). |
| `GET` | `/accounts` | List synced accounts from D1. |
| `GET` | `/accounts/random` | Fetch one random account from D1. |
| `POST` | `/sync` | Login to Swapfaces, fetch account detail, then upsert into D1. |
| `POST` | `/image-to-image` | Use a random account token from D1 to call Swapfaces image-to-image, then async refresh account detail. |
| `POST` | `/upload/presign` | Use a random account token to call Swapfaces `POST /api/upload/presign` (same query string and browser-like headers as the official site). Response body matches upstream (`code`, `message`, `result`). |
| `POST` | `/unlimit-face-swapper/detect` | Random account: call upstream face detect; writes `action_id` + **same** `token` into `image_tasks`. Response matches upstream (`code`, `message`, `actionId`). |
| `GET` | `/action/info/:actionId` | Looks up `image_tasks` by `action_id`, uses **stored token** to call upstream `GET /api/action/info`. Optional query `website` (default `swapfaces`). Marks task `state=2` when `result.status === "success"`. |
| `GET` | `/image-tasks/:actionId` | Query image task result by `actionId` using upstream action history. |

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create the D1 database if you have not already:

   ```bash
   npx wrangler d1 create swapfaces
   ```

3. Put the returned `database_id` into `wrangler.jsonc`.

4. Run the migration:

   ```bash
   npx wrangler d1 migrations apply swapfaces
   ```

5. Start local development:

   ```bash
   npm run dev
   ```

## Manual sync example

```bash
curl -X POST http://127.0.0.1:8787/sync \
  -H 'Content-Type: application/json' \
  -d '{}'
```

You can also override parts of the login payload:

```json
{
  "platform": "guest",
  "website": "swapfaces",
  "device": {
    "screenWidth": 1728,
    "screenHeight": 1117
  }
}
```

## Image To Image

`POST /image-to-image` expects a JSON body and **does not accept a caller-provided token**.  
The Worker selects one random account token from D1.

Required field:

- `imageUrl` (string, non-empty)

Optional fields:

- `style` (string, default: `undress`)
- `website` (string, default: `swapfaces`)

Example:

```bash
curl -X POST https://api.opengoon.art/image-to-image \
  -H 'Content-Type: application/json' \
  -d '{
    "imageUrl": "https://files.swapfaces.ai/Swapfaces.AI_20260510_44554a35-1085-47be-8bb5-dcc81d38c0fc.jpeg",
    "style": "undress",
    "website": "swapfaces"
  }'
```

If the upstream call succeeds, the Worker inserts a task record into `image_tasks` and asynchronously refreshes account detail in D1.

## Upload presign

`POST /upload/presign` **does not accept a caller-provided token**. The Worker picks a random account from D1 and calls Swapfaces with the same style of request as the web app (query `action_type` + `content_type`, `Content-Type: text/plain;charset=UTF-8`, Chrome-like headers, empty POST body).

**Query parameters** (optional; defaults match the site):

| Query | Default |
| --- | --- |
| `action_type` | `image_unlimit_face_swapper` |
| `content_type` | `image/jpeg` (sent as `image%2Fjpeg` in the upstream URL) |

You can also pass `action_type` / `content_type` (or camelCase `actionType` / `contentType`) in a JSON body; **query string wins** if both are present.

**Successful response** is the upstream JSON (not wrapped in `{ ok, data }`), for example:

```json
{
  "code": 200,
  "message": "Success",
  "result": {
    "presignUrl": "https://files.swapfaces.ai/....jpeg",
    "url": "https://files.swapfaces.ai/....jpeg"
  }
}
```

Example (defaults in query, same as upstream curl):

```bash
curl -X POST \
  'https://api.opengoon.art/upload/presign?action_type=image_unlimit_face_swapper&content_type=image%2Fjpeg'
```

If no rows exist in `swapfaces_accounts`, the Worker returns HTTP **503** with body `{ "code": 503, "message": "...", "result": null }`.

## Face swapper detect & action info

Detect uses a **random** account token from D1, same pattern as `/upload/presign`. The returned `actionId` is stored in **`image_tasks`** together with that token so the follow-up call uses the **same** authorization.

**`POST /unlimit-face-swapper/detect`** — JSON body:

- `imageUrl` (required)
- `website` (optional, default `swapfaces`)

**`GET /action/info/:actionId`** — resolves the task in `image_tasks`, then calls upstream `GET /api/action/info?action_id=...&website=...`. Optional query: `website` (default `swapfaces`). Response body is upstream JSON. When `result.status === "success"`, the task row is updated to `state = 2`.

```bash
curl -X POST https://api.opengoon.art/unlimit-face-swapper/detect \
  -H 'Content-Type: application/json' \
  -d '{"imageUrl":"https://files.swapfaces.ai/your.jpeg","website":"swapfaces"}'

curl -sS "https://api.opengoon.art/action/info/228212342?website=swapfaces"
```

## Image Task Query

Use `GET /image-tasks/:actionId` to query task status/result.

```bash
curl -X GET https://api.opengoon.art/image-tasks/1234567890
```

If the task does not exist in D1, response is `404`:

```json
{
  "ok": false,
  "error": "Task not found"
}
```

## Random Account

```bash
curl -X GET https://api.opengoon.art/accounts/random
```

If the table is empty, the response is:

```json
{
   "ok": true,
   "data": null
}
```