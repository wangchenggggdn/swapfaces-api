import { logSync } from "../db.js";
import { jsonResponse, readJsonBody } from "../http.js";
import { syncSwapfacesAccount } from "../swapfaces/sync.js";

export async function handleSync(request, env, ctx) {
  try {
    const body = await readJsonBody(request);
    const result = await syncSwapfacesAccount(env, body ?? {});
    if (result.accountKept) {
      ctx.waitUntil(logSync(env, result.record.id, "manual"));
    }
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
