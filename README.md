# swapfaces-api

Cloudflare Worker that logs into Swapfaces, fetches account detail, and stores the token plus account fields in D1.

## Endpoints

Base URL examples:

- Local: `http://127.0.0.1:8787`
- Production: `https://api.opengoon.art`

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Health check. |
| `GET` | `/accounts` | List synced accounts from D1. |
| `GET` | `/accounts/random` | Fetch one random account from D1. |
| `POST` | `/sync` | Login to Swapfaces, fetch account detail, then upsert into D1. |
| `POST` | `/image-to-image` | Use a random account token from D1 to call Swapfaces image-to-image, then async refresh account detail. |
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