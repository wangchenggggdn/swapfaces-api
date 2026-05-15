import { insertImageTask, getRandomAccount } from "../db.js";
import { jsonResponse, readJsonBody } from "../http.js";
import { requestActionHistory, requestImageToImage } from "../swapfaces/client.js";
import { isPlainObject } from "../swapfaces/parse.js";
import { refreshAccountByToken } from "../swapfaces/sync.js";

export async function handleImageToImage(request, env, ctx) {
  try {
    const body = await readJsonBody(request);
    const params = buildImageToImageParams(body);

    const account = await getRandomAccount(env);

    if (!account?.token) {
      return jsonResponse(
        { ok: false, error: "No accounts in database, run POST /sync first" },
        503
      );
    }

    const result = await requestImageToImage(account.token, params);

    const actionId =
      result?.data?.actionId != null
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

export async function handleGetImageTask(actionId, env) {
  try {
    const task = await env.DB.prepare(
      `SELECT token, state FROM image_tasks WHERE action_id = ? LIMIT 1`
    )
      .bind(actionId)
      .first();

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
