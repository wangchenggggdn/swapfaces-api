import { DEFAULT_DEVICE } from "./swapfaces/constants.js";

export function createBaseHeaders(extraHeaders = {}) {
  return {
    accept: "*/*",
    origin: "https://www.swapfaces.ai",
    referer: "https://www.swapfaces.ai/",
    "user-agent": DEFAULT_DEVICE.userAgent,
    ...extraHeaders
  };
}

export async function parseApiResponse(response, label) {
  const text = await response.text();
  let json;

  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${label} returned non-JSON response: ${text.slice(0, 300)}`);
  }

  if (!response.ok) {
    throw new Error(`${label} failed with ${response.status}: ${JSON.stringify(json)}`);
  }

  return json;
}

export function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8"
    }
  });
}

export async function readJsonBody(request) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return null;
  }

  return request.json();
}
