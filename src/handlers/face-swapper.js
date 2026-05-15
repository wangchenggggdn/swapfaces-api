import { insertImageTask, getRandomAccount } from "../db.js";
import { readJsonBody, swapfacesJsonResponse } from "../http.js";
import { requestActionInfo, requestUnlimitFaceSwapperDetect } from "../swapfaces/client.js";
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
