import {
  ACTION_HISTORY_URL,
  ACTION_INFO_URL,
  DETAIL_URL,
  IMAGE_TO_IMAGE_URL,
  LOGIN_URL,
  UNLIMIT_FACE_SWAPPER_DETECT_URL,
  UNLIMIT_FACE_SWAPPER_SWAP_URL,
  UPLOAD_PRESIGN_URL
} from "./constants.js";
import { createBaseHeaders, parseApiResponse } from "../http.js";

const SWAPFACES_CHROME_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36";

/** 与官网 curl 一致的浏览器 CORS 请求头（按需再叠 content-type 等）。 */
function swapfacesChromeHeaders(token, overrides = {}) {
  return {
    accept: "*/*",
    "accept-language": "zh-CN,zh;q=0.9",
    authorization: token,
    "cache-control": "no-cache",
    origin: "https://www.swapfaces.ai",
    pragma: "no-cache",
    priority: "u=1, i",
    referer: "https://www.swapfaces.ai/",
    "sec-ch-ua": '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "user-agent": SWAPFACES_CHROME_UA,
    ...overrides
  };
}

export async function requestLogin(payload) {
  const response = await fetch(LOGIN_URL, {
    method: "POST",
    headers: createBaseHeaders({
      "content-type": "application/json"
    }),
    body: JSON.stringify(payload)
  });

  return parseApiResponse(response, "Swapfaces login");
}

export async function requestAccountDetail(token) {
  const response = await fetch(DETAIL_URL, {
    method: "GET",
    headers: createBaseHeaders({
      authorization: token
    })
  });

  return parseApiResponse(response, "Swapfaces account detail");
}

export async function requestImageToImage(token, params) {
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

/**
 * @param {string} token
 * @param {{ offset?: number, limit?: number, actionTypes?: string[], website?: string }} [options]
 * 当 actionTypes 含 `image_unlimit_face_swapper` 时使用与官网一致的 Chrome 请求头（换脸历史查询）。
 */
export async function requestActionHistory(token, options = {}) {
  const payload = {
    offset: typeof options.offset === "number" ? options.offset : 0,
    limit: typeof options.limit === "number" ? options.limit : 30,
    actionTypes:
      Array.isArray(options.actionTypes) && options.actionTypes.length > 0
        ? options.actionTypes
        : ["image_image_to_image"],
    website:
      typeof options.website === "string" && options.website ? options.website : "swapfaces"
  };

  const useChrome =
    Array.isArray(payload.actionTypes) &&
    payload.actionTypes.includes("image_unlimit_face_swapper");

  const response = await fetch(ACTION_HISTORY_URL, {
    method: "POST",
    headers: useChrome
      ? swapfacesChromeHeaders(token, { "content-type": "application/json" })
      : createBaseHeaders({
          authorization: token,
          "content-type": "application/json"
        }),
    body: JSON.stringify(payload)
  });

  return parseApiResponse(response, "Swapfaces action history");
}

export async function requestUnlimitFaceSwapperDetect(token, params) {
  const response = await fetch(UNLIMIT_FACE_SWAPPER_DETECT_URL, {
    method: "POST",
    headers: swapfacesChromeHeaders(token, {
      "content-type": "application/json"
    }),
    body: JSON.stringify({
      imageUrl: params.imageUrl,
      website: params.website
    })
  });

  return parseApiResponse(response, "Swapfaces unlimit face swapper detect");
}

export async function requestUnlimitFaceSwapperSwap(token, params) {
  const response = await fetch(UNLIMIT_FACE_SWAPPER_SWAP_URL, {
    method: "POST",
    headers: swapfacesChromeHeaders(token, {
      "content-type": "application/json"
    }),
    body: JSON.stringify({
      imageUrl: params.imageUrl,
      items: params.items,
      website: params.website
    })
  });

  return parseApiResponse(response, "Swapfaces unlimit face swapper swap");
}

export async function requestActionInfo(token, actionId, website = "swapfaces") {
  const u = new URL(ACTION_INFO_URL);
  u.searchParams.set("action_id", String(actionId));
  u.searchParams.set("website", website);

  const response = await fetch(u.toString(), {
    method: "GET",
    headers: swapfacesChromeHeaders(token)
  });

  return parseApiResponse(response, "Swapfaces action info");
}

/**
 * @param {string} token
 * @param {{ actionType?: string, contentType?: string }} [options] 对应 query：action_type、content_type（默认与 curl 一致）
 */
export async function requestUploadPresign(token, options = {}) {
  const actionType =
    typeof options.actionType === "string" && options.actionType
      ? options.actionType
      : "image_unlimit_face_swapper";
  const contentType =
    typeof options.contentType === "string" && options.contentType
      ? options.contentType
      : "image/jpeg";

  const qs = `action_type=${encodeURIComponent(actionType)}&content_type=${encodeURIComponent(contentType)}`;
  const url = `${UPLOAD_PRESIGN_URL}?${qs}`;

  const response = await fetch(url, {
    method: "POST",
    headers: swapfacesChromeHeaders(token, {
      "content-type": "text/plain;charset=UTF-8"
    })
  });

  return parseApiResponse(response, "Swapfaces upload presign");
}
