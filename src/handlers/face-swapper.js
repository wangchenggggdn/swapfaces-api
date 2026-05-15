import { insertImageTask, getRandomAccount } from "../db.js";
import { jsonResponse, readJsonBody, swapfacesJsonResponse } from "../http.js";
import {
  requestActionHistory,
  requestActionInfo,
  requestUnlimitFaceSwapperDetect,
  requestUnlimitFaceSwapperSwap
} from "../swapfaces/client.js";
import { isPlainObject } from "../swapfaces/parse.js";
import { refreshAccountByToken } from "../swapfaces/sync.js";

export async function handleUnlimitFaceSwapperDetect(request, env, ctx) {
  try {
    const body = await readJsonBody(request);
    const params = buildDetectParams(body);

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

    const result = await requestUnlimitFaceSwapperDetect(account.token, params);

    const actionId =
      result?.actionId != null
        ? String(result.actionId)
        : result?.data?.actionId != null
          ? String(result.data.actionId)
          : null;

    ctx.waitUntil(
      Promise.all([
        insertImageTask(env, actionId, account.token, account.id),
        refreshAccountByToken(env, account.token, "unlimit-face-swapper-detect")
      ])
    );

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

export async function handleGetActionInfo(request, actionId, env) {
  try {
    const task = await env.DB.prepare(
      `SELECT token, state FROM image_tasks WHERE action_id = ? LIMIT 1`
    )
      .bind(actionId)
      .first();

    if (!task) {
      return swapfacesJsonResponse(
        {
          code: 404,
          message: "Task not found",
          result: null
        },
        404
      );
    }

    const reqUrl = new URL(request.url);
    const website = reqUrl.searchParams.get("website") || "swapfaces";

    const info = await requestActionInfo(task.token, actionId, website);

    const status = info?.result?.status;
    if (status === "success" && task.state !== 2) {
      await env.DB.prepare(`UPDATE image_tasks SET state = 2 WHERE action_id = ?`)
        .bind(actionId)
        .run();
    }

    return swapfacesJsonResponse(info, 200);
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

export async function handleUnlimitFaceSwapperSwap(request, env, ctx) {
  try {
    const body = await readJsonBody(request);
    const params = buildSwapParams(body);

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

    const result = await requestUnlimitFaceSwapperSwap(account.token, params);

    const actionId =
      result?.actionId != null
        ? String(result.actionId)
        : result?.data?.actionId != null
          ? String(result.data.actionId)
          : null;

    ctx.waitUntil(
      Promise.all([
        insertImageTask(env, actionId, account.token, account.id),
        refreshAccountByToken(env, account.token, "unlimit-face-swapper-swap")
      ])
    );

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

export async function handleGetFaceSwapperTask(actionId, env) {
  try {
    const task = await env.DB.prepare(
      `SELECT token, state FROM image_tasks WHERE action_id = ? LIMIT 1`
    )
      .bind(actionId)
      .first();

    if (!task) {
      return jsonResponse({ ok: false, error: "Task not found" }, 404);
    }

    const historyJson = await requestActionHistory(task.token, {
      actionTypes: ["image_unlimit_face_swapper"]
    });

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

    if (matched && matched.status === "success" && task.state !== 2) {
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

function buildDetectParams(body) {
  if (!isPlainObject(body)) {
    throw new Error("Request body must be a JSON object");
  }

  if (typeof body.imageUrl !== "string" || !body.imageUrl) {
    throw new Error("Request body must include a non-empty imageUrl field");
  }

  return {
    imageUrl: body.imageUrl,
    website: typeof body.website === "string" && body.website ? body.website : "swapfaces"
  };
}

function buildSwapParams(body) {
  if (!isPlainObject(body)) {
    throw new Error("Request body must be a JSON object");
  }

  if (typeof body.imageUrl !== "string" || !body.imageUrl) {
    throw new Error("Request body must include a non-empty imageUrl field");
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new Error("Request body must include a non-empty items array");
  }

  const items = [];
  for (let i = 0; i < body.items.length; i++) {
    const item = body.items[i];
    if (!isPlainObject(item)) {
      throw new Error(`items[${i}] must be an object`);
    }
    if (typeof item.faceUrl !== "string" || !item.faceUrl) {
      throw new Error(`items[${i}] must include a non-empty faceUrl`);
    }
    if (typeof item.sourceUrl !== "string" || !item.sourceUrl) {
      throw new Error(`items[${i}] must include a non-empty sourceUrl`);
    }
    items.push({ faceUrl: item.faceUrl, sourceUrl: item.sourceUrl });
  }

  return {
    imageUrl: body.imageUrl,
    items,
    website: typeof body.website === "string" && body.website ? body.website : "swapfaces"
  };
}
