import {
  ACTION_HISTORY_URL,
  DETAIL_URL,
  IMAGE_TO_IMAGE_URL,
  LOGIN_URL,
  UPLOAD_PRESIGN_URL
} from "./constants.js";
import { createBaseHeaders, parseApiResponse } from "../http.js";

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

export async function requestActionHistory(token) {
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

/**
 * @param {string} token
 * @param {{ actionType?: string, contentType?: string }} [options]
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

  const url = new URL(UPLOAD_PRESIGN_URL);
  url.searchParams.set("action_type", actionType);
  url.searchParams.set("content_type", contentType);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: createBaseHeaders({
      authorization: token,
      "content-type": "text/plain;charset=UTF-8"
    }),
    body: ""
  });

  return parseApiResponse(response, "Swapfaces upload presign");
}
