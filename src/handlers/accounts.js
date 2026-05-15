import { jsonResponse } from "../http.js";

export async function handleListAccounts(env) {
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

export async function handleRandomAccount(env) {
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
