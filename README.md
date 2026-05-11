# swapfaces-api

Cloudflare Worker that logs into Swapfaces, fetches account detail, and stores the token plus account fields in D1.

## Endpoints

- `GET /health`: simple health check.
- `GET /accounts`: list synced accounts from D1.
- `GET /accounts/random`: fetch one random record from D1.
- `POST /sync`: call Swapfaces login and detail APIs, then upsert into D1.
- `POST /image-to-image`: call Swapfaces image-to-image with an explicit token, then asynchronously refresh that account in D1.

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

The `POST /image-to-image` endpoint requires the caller to explicitly provide the token to use.

```bash
curl -X POST https://api.opengoon.art/image-to-image \
   -H 'Content-Type: application/json' \
   -d '{
      "token": "YOUR_SWAPFACES_TOKEN"
   }'
```

The upstream request uses the fixed payload below:

```json
{
   "imageUrl": "https://files.swapfaces.ai/Swapfaces.AI_20260510_44554a35-1085-47be-8bb5-dcc81d38c0fc.jpeg",
   "style": "undress",
   "website": "swapfaces"
}
```

If the upstream image-to-image call succeeds, the Worker asynchronously calls the account detail endpoint and updates the matching account record in D1.

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