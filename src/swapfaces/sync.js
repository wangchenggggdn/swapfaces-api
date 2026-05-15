import { requestAccountDetail, requestLogin } from "./client.js";
import { DEFAULT_DEVICE, DEFAULT_LOGIN_PAYLOAD } from "./constants.js";
import { extractAccount, extractToken, isPlainObject, normalizeRecord, pickDefined } from "./parse.js";
import { logSync, upsertAccount } from "../db.js";

export function assertBindings(env) {
  if (!env?.DB) {
    throw new Error("Missing D1 binding: DB");
  }
}

export function buildLoginPayload(overrides) {
  const deviceOverrides = isPlainObject(overrides.device) ? overrides.device : {};

  return {
    ...DEFAULT_LOGIN_PAYLOAD,
    ...pickDefined(overrides, ["platform", "website"]),
    device: {
      ...DEFAULT_DEVICE,
      ...deviceOverrides
    }
  };
}

export async function syncSwapfacesAccount(env, overrides = {}) {
  assertBindings(env);

  const loginPayload = buildLoginPayload(overrides);
  const loginJson = await requestLogin(loginPayload);
  const token = extractToken(loginJson);

  if (!token) {
    throw new Error("Swapfaces login response did not include a token");
  }

  const detailJson = await requestAccountDetail(token);
  const account = extractAccount(detailJson);

  if (!account?.id) {
    throw new Error("Swapfaces detail response did not include account data");
  }

  const record = normalizeRecord(account, token);
  await upsertAccount(env, record, detailJson);

  return {
    token,
    record
  };
}

export async function refreshAccountByToken(env, token, source) {
  try {
    const detailJson = await requestAccountDetail(token);
    const account = extractAccount(detailJson);

    if (!account?.id) {
      throw new Error("Swapfaces detail response did not include account data");
    }

    const record = normalizeRecord(account, token);
    await upsertAccount(env, record, detailJson);
    await logSync(env, record.id, source);
  } catch (error) {
    console.error(`Failed to refresh account after ${source}`, error);
  }
}
