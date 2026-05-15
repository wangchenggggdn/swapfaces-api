import { getRandomAccount } from "../db.js";
import { readJsonBody, swapfacesJsonResponse } from "../http.js";
import { requestUploadPresign } from "../swapfaces/client.js";
import { isPlainObject } from "../swapfaces/parse.js";
import { refreshAccountByToken } from "../swapfaces/sync.js";

function pickString(...candidates) {
  for (const c of candidates) {
    if (typeof c === "string" && c) {
      return c;
    }
  }
  return undefined;
}

export async function handleUploadPresign(request, env, ctx) {
  try {
    const reqUrl = new URL(request.url);
    const raw = await readJsonBody(request);
    const body = isPlainObject(raw) ? raw : {};

    const actionType = pickString(
      reqUrl.searchParams.get("action_type"),
      body.action_type,
      body.actionType
    );
    const contentType = pickString(
      reqUrl.searchParams.get("content_type"),
      body.content_type,
      body.contentType
    );

    const account = await getRandomAccount(env);

    if (!account?.token) {
      return swapfacesJsonResponse(
        {
          code: 503,
          message: "No accounts in database, run POST /sync first",
          result: null
        },
        503
      );
    }

    const result = await requestUploadPresign(account.token, {
      actionType,
      contentType
    });

    ctx.waitUntil(refreshAccountByToken(env, account.token, "upload-presign"));

    return swapfacesJsonResponse(result, 200);
  } catch (error) {
    return swapfacesJsonResponse(
      {
        code: 500,
        message: error instanceof Error ? error.message : "Unknown error",
        result: null
      },
      500
    );
  }
}
