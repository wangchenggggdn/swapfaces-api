const LOGIN_URL = "https://api.swapfaces.ai/api/account/login";
const DETAIL_URL = "https://api.swapfaces.ai/api/account/detail?website=swapfaces";
const IMAGE_TO_IMAGE_URL = "https://api.swapfaces.ai/api/image/image-to-image";
const ACTION_HISTORY_URL = "https://api.swapfaces.ai/api/account/action/history";

const DEFAULT_DEVICE = {
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:150.0) Gecko/20100101 Firefox/150.0",
  lang: "en-US",
  platform: "MacIntel",
  screenWidth: 1440,
  screenHeight: 900,
  screenColorDepth: 30,
  screenPixelDepth: 30,
  audioFingerprint: 35.749972093850374
};

const DEFAULT_LOGIN_PAYLOAD = {
  platform: "guest",
  device: DEFAULT_DEVICE,
  website: "swapfaces"
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse({ ok: true, service: "swapfaces-api" });
    }

    if (request.method === "GET" && url.pathname === "/accounts") {
      return handleListAccounts(env);
    }

    if (request.method === "GET" && url.pathname === "/accounts/random") {
      return handleRandomAccount(env);
    }

    if (request.method === "POST" && url.pathname === "/sync") {
      return handleSync(request, env, ctx);
    }

    if (request.method === "POST" && url.pathname === "/image-to-image") {
      return handleImageToImage(request, env, ctx);
    }

    const imageTaskMatch = request.method === "GET" && url.pathname.match(/^\/image-tasks\/(.+)$/);
    if (imageTaskMatch) {
      return handleGetImageTask(imageTaskMatch[1], env);
    }

    return jsonResponse(
      {
        ok: false,
        error: "Not found",
        routes: ["GET /health", "GET /accounts", "GET /accounts/random", "POST /sync", "POST /image-to-image", "GET /image-tasks/:actionId"]
      },
      404
    );
  },

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(syncSwapfacesAccount(env));
  }
};

async function handleSync(request, env, ctx) {
  try {
    const body = await readJsonBody(request);
    const result = await syncSwapfacesAccount(env, body ?? {});
    ctx.waitUntil(logSync(env, result.record.id, "manual"));
    return jsonResponse({ ok: true, source: "manual", data: result }, 201);
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error"
      },
      500
    );
  }
}

async function handleImageToImage(request, env, ctx) {
  try {
    const body = await readJsonBody(request);
    const params = buildImageToImageParams(body);

    const account = await env.DB.prepare(
      `SELECT id, token FROM swapfaces_accounts ORDER BY RANDOM() LIMIT 1`
    ).first();

    if (!account?.token) {
      return jsonResponse(
        { ok: false, error: "No accounts in database, run POST /sync first" },
        503
      );
    }

    const result = await requestImageToImage(account.token, params);

    const actionId = result?.data?.actionId != null
      ? String(result.data.actionId)
      : result?.actionId != null
        ? String(result.actionId)
        : null;
    ctx.waitUntil(
      Promise.all([
        insertImageTask(env, actionId, account.token, account.id),
        refreshAccountByToken(env, account.token, "image-to-image")
      ])
    );

    return jsonResponse({ ok: true, data: result }, 201);
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error"
      },
      500
    );
  }
}

async function handleListAccounts(env) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, platform, external_id, username, credits, website, token, created_at, updated_at
       FROM swapfaces_accounts
       ORDER BY updated_at DESC`
    ).all();

    return jsonResponse({ ok: true, data: results });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error"
      },
      500
    );
  }
}

async function handleRandomAccount(env) {
  try {
    const result = await env.DB.prepare(
      `SELECT id, platform, external_id, username, credits, website, token, created_at, updated_at
       FROM swapfaces_accounts
       ORDER BY RANDOM()
       LIMIT 1`
    ).first();

    return jsonResponse({ ok: true, data: result ?? null });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error"
      },
      500
    );
  }
}

async function syncSwapfacesAccount(env, overrides = {}) {
  assertBindings(env);

  const loginPayload = buildLoginPayload(overrides);
  const loginJson = await requestLogin(loginPayload);
  const token = extractToken(loginJson);

  if (!token) {
    throw new Error("Swapfaces login response did not include a token");
  }

  const detailJson = await requestAccountDetail(token);
  const account = extractAccount(detailJson);

  if (!account?.id) {
    throw new Error("Swapfaces detail response did not include account data");
  }

  const record = normalizeRecord(account, token);
  await upsertAccount(env, record, detailJson);

  return {
    token,
    record
  };
}

function assertBindings(env) {
  if (!env?.DB) {
    throw new Error("Missing D1 binding: DB");
  }
}

function buildLoginPayload(overrides) {
  const deviceOverrides = isPlainObject(overrides.device) ? overrides.device : {};

  return {
    ...DEFAULT_LOGIN_PAYLOAD,
    ...pickDefined(overrides, ["platform", "website"]),
    device: {
      ...DEFAULT_DEVICE,
      ...deviceOverrides
    }
  };
}

async function requestLogin(payload) {
  const response = await fetch(LOGIN_URL, {
    method: "POST",
    headers: createBaseHeaders({
      "content-type": "application/json"
    }),
    body: JSON.stringify(payload)
  });

  return parseApiResponse(response, "Swapfaces login");
}

async function requestAccountDetail(token) {
  const response = await fetch(DETAIL_URL, {
    method: "GET",
    headers: createBaseHeaders({
      authorization: token
    })
  });

  return parseApiResponse(response, "Swapfaces account detail");
}

async function requestImageToImage(token, params) {
  const response = await fetch(IMAGE_TO_IMAGE_URL, {
    method: "POST",
    headers: createBaseHeaders({
      authorization: token,
      "content-type": "application/json"
    }),
    body: JSON.stringify({
      imageUrl: params.imageUrl,
      style: params.style,
      website: params.website
    })
  });

  return parseApiResponse(response, "Swapfaces image-to-image");
}

async function refreshAccountByToken(env, token, source) {
  try {
    const detailJson = await requestAccountDetail(token);
    const account = extractAccount(detailJson);

    if (!account?.id) {
      throw new Error("Swapfaces detail response did not include account data");
    }

    const record = normalizeRecord(account, token);
    await upsertAccount(env, record, detailJson);
    await logSync(env, record.id, source);
  } catch (error) {
    console.error("Failed to refresh account after image-to-image", error);
  }
}

function createBaseHeaders(extraHeaders = {}) {
  return {
    accept: "*/*",
    origin: "https://www.swapfaces.ai",
    referer: "https://www.swapfaces.ai/",
    "user-agent": DEFAULT_DEVICE.userAgent,
    ...extraHeaders
  };
}

async function parseApiResponse(response, label) {
  const text = await response.text();
  let json;

  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${label} returned non-JSON response: ${text.slice(0, 300)}`);
  }

  if (!response.ok) {
    throw new Error(`${label} failed with ${response.status}: ${JSON.stringify(json)}`);
  }

  return json;
}

function extractToken(payload) {
  const candidates = [
    payload?.token,
    payload?.data?.token,
    payload?.data?.accessToken,
    payload?.data?.jwt,
    payload?.result?.token
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate) {
      return candidate;
    }
  }

  return findStringValue(payload, new Set(["token", "accessToken", "jwt"]));
}

function extractAccount(payload) {
  const directCandidates = [payload?.data, payload?.result, payload];

  for (const candidate of directCandidates) {
    if (looksLikeAccount(candidate)) {
      return candidate;
    }
  }

  return findObject(payload, looksLikeAccount);
}

function looksLikeAccount(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  return ["id", "platform", "website"].every((key) => key in value);
}

function normalizeRecord(account, token) {
  return {
    id: Number(account.id),
    platform: stringOrNull(account.platform),
    externalId: stringOrNull(account.externalId),
    username: stringOrNull(account.username),
    credits: numberOrNull(account.credits),
    website: stringOrNull(account.website),
    token
  };
}

async function upsertAccount(env, record, detailPayload) {
  await env.DB.prepare(
    `INSERT INTO swapfaces_accounts (
      id,
      platform,
      external_id,
      username,
      credits,
      website,
      token,
      raw_detail,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      platform = excluded.platform,
      external_id = excluded.external_id,
      username = excluded.username,
      credits = excluded.credits,
      website = excluded.website,
      token = excluded.token,
      raw_detail = excluded.raw_detail,
      updated_at = datetime('now')`
  )
    .bind(
      record.id,
      record.platform,
      record.externalId,
      record.username,
      record.credits,
      record.website,
      record.token,
      JSON.stringify(detailPayload)
    )
    .run();
}

async function handleGetImageTask(actionId, env) {
  try {
    const task = await env.DB.prepare(
      `SELECT token, state FROM image_tasks WHERE action_id = ? LIMIT 1`
    ).bind(actionId).first();

    if (!task) {
      return jsonResponse({ ok: false, error: "Task not found" }, 404);
    }

    const historyJson = await requestActionHistory(task.token);

    const list =
      historyJson?.data?.actions ??
      historyJson?.data?.list ??
      (Array.isArray(historyJson?.data) ? historyJson.data : null) ??
      historyJson?.list ??
      (Array.isArray(historyJson?.result) ? historyJson.result : null) ??
      [];

    const matched = Array.isArray(list)
      ? list.find((a) => String(a.actionId ?? a.id ?? "") === String(actionId))
      : null;

    if (matched && task.state !== 2) {
      await env.DB.prepare(`UPDATE image_tasks SET state = 2 WHERE action_id = ?`)
        .bind(actionId)
        .run();
    }

    return jsonResponse({
      code: historyJson.code,
      message: historyJson.message,
      result: matched ? [matched] : [],
      totals: matched ? 1 : 0
    });
  } catch (error) {
    return jsonResponse(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      500
    );
  }
}

async function requestActionHistory(token) {
  const response = await fetch(ACTION_HISTORY_URL, {
    method: "POST",
    headers: createBaseHeaders({
      authorization: token,
      "content-type": "application/json"
    }),
    body: JSON.stringify({
      offset: 0,
      limit: 30,
      actionTypes: ["image_image_to_image"],
      website: "swapfaces"
    })
  });

  return parseApiResponse(response, "Swapfaces action history");
}

async function insertImageTask(env, actionId, token, userId) {
  await env.DB.prepare(
    `INSERT INTO image_tasks (action_id, token, user_id, state, created_at)
     VALUES (?, ?, ?, 1, datetime('now'))`
  )
    .bind(actionId, token, userId ?? null)
    .run();
}

async function logSync(env, accountId, source) {
  await env.DB.prepare(
    `INSERT INTO sync_logs (account_id, source, created_at)
     VALUES (?, ?, datetime('now'))`
  )
    .bind(accountId, source)
    .run();
}

async function readJsonBody(request) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return null;
  }

  return request.json();
}

function buildImageToImageParams(body) {
  if (!isPlainObject(body)) {
    throw new Error("Request body must be a JSON object");
  }

  if (typeof body.imageUrl !== "string" || !body.imageUrl) {
    throw new Error("Request body must include a non-empty imageUrl field");
  }

  return {
    imageUrl: body.imageUrl,
    style: typeof body.style === "string" && body.style ? body.style : "undress",
    website: typeof body.website === "string" && body.website ? body.website : "swapfaces"
  };
}

function pickDefined(source, keys) {
  const output = {};

  for (const key of keys) {
    if (source[key] !== undefined) {
      output[key] = source[key];
    }
  }

  return output;
}

function stringOrNull(value) {
  return typeof value === "string" ? value : null;
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findStringValue(value, allowedKeys) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const result = findStringValue(item, allowedKeys);
      if (result) {
        return result;
      }
    }
    return null;
  }

  if (!isPlainObject(value)) {
    return null;
  }

  for (const [key, entry] of Object.entries(value)) {
    if (allowedKeys.has(key) && typeof entry === "string" && entry) {
      return entry;
    }
  }

  for (const entry of Object.values(value)) {
    const result = findStringValue(entry, allowedKeys);
    if (result) {
      return result;
    }
  }

  return null;
}

function findObject(value, predicate) {
  if (predicate(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const result = findObject(item, predicate);
      if (result) {
        return result;
      }
    }
    return null;
  }

  if (!isPlainObject(value)) {
    return null;
  }

  for (const entry of Object.values(value)) {
    const result = findObject(entry, predicate);
    if (result) {
      return result;
    }
  }

  return null;
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8"
    }
  });
}