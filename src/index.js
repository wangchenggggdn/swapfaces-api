import { handleListAccounts, handleRandomAccount } from "./handlers/accounts.js";
import { handleGetImageTask, handleImageToImage } from "./handlers/image.js";
import { handleSync } from "./handlers/sync-route.js";
import { handleUploadPresign } from "./handlers/upload.js";
import { jsonResponse } from "./http.js";
import { syncSwapfacesAccount } from "./swapfaces/sync.js";

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

    if (request.method === "POST" && url.pathname === "/upload/presign") {
      return handleUploadPresign(request, env, ctx);
    }

    const imageTaskMatch = request.method === "GET" && url.pathname.match(/^\/image-tasks\/(.+)$/);
    if (imageTaskMatch) {
      return handleGetImageTask(imageTaskMatch[1], env);
    }

    return jsonResponse(
      {
        ok: false,
        error: "Not found",
        routes: [
          "GET /health",
          "GET /accounts",
          "GET /accounts/random",
          "POST /sync",
          "POST /image-to-image",
          "POST /upload/presign",
          "GET /image-tasks/:actionId"
        ]
      },
      404
    );
  },

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(syncSwapfacesAccount(env));
  }
};
