import { getRandomAccount } from "../db.js";
import { jsonResponse, readJsonBody } from "../http.js";
import { requestUploadPresign } from "../swapfaces/client.js";
import { isPlainObject } from "../swapfaces/parse.js";
import { refreshAccountByToken } from "../swapfaces/sync.js";

export async function handleUploadPresign(request, env, ctx) {
  try {
    const raw = await readJsonBody(request);
    const body = isPlainObject(raw) ? raw : {};

    const account = await getRandomAccount(env);

    if (!account?.token) {
      return jsonResponse(
        { ok: false, error: "No accounts in database, run POST /sync first" },
        503
      );
    }

    const result = await requestUploadPresign(account.token, {
      actionType: typeof body.actionType === "string" && body.actionType ? body.actionType : undefined,
      contentType: typeof body.contentType === "string" && body.contentType ? body.contentType : undefined
    });

    ctx.waitUntil(refreshAccountByToken(env, account.token, "upload-presign"));

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
