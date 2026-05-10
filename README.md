# swapfaces-api

Cloudflare Worker that logs into Swapfaces, fetches account detail, and stores the token plus account fields in D1.

## Endpoints

- `GET /health`: simple health check.
- `GET /accounts`: list synced accounts from D1.
- `POST /sync`: call Swapfaces login and detail APIs, then upsert into D1.

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