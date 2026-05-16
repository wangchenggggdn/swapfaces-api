import {
  countHealthyAccounts,
  deleteAccountById,
  logSync,
  POOL_MIN_CREDITS_EXCLUSIVE,
  POOL_TARGET_COUNT,
  upsertAccount
} from "../db.js";
import { requestAccountDetail, requestLogin } from "./client.js";
import { DEFAULT_DEVICE, DEFAULT_LOGIN_PAYLOAD } from "./constants.js";
import { extractAccount, extractToken, isPlainObject, normalizeRecord, pickDefined } from "./parse.js";

/** 同步补齐池时的最大尝试次数（避免无限循环） */
const ENSURE_POOL_MAX_ATTEMPTS = 80;

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

/** credits 为空或非有限数，或严格小于 30 → 从表中移除 */
export function shouldDeleteAccountForCredits(record) {
  const c = record?.credits;
  if (c == null || !Number.isFinite(Number(c))) {
    return true;
  }
  return Number(c) < POOL_MIN_CREDITS_EXCLUSIVE;
}

async function loginAndFetchDetail(env, overrides = {}) {
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
  return { token, record, detailJson };
}

/**
 * 写入 detail；若 credits 不达标则删号；再补齐池中 credits > 30 的账号数量。
 * @returns 本条账号是否仍留在表中（未因低 credits 被删）
 */
export async function persistDetailThenMaintainPool(env, record, detailJson, overrides = {}) {
  await upsertAccount(env, record, detailJson);

  let kept = true;
  if (shouldDeleteAccountForCredits(record)) {
    await deleteAccountById(env, record.id);
    kept = false;
  }

  await ensureHealthyAccountPool(env, overrides);
  return kept;
}

/**
 * 直至表中至少有 POOL_TARGET_COUNT 条 credits > POOL_MIN_CREDITS_EXCLUSIVE 的记录。
 */
export async function ensureHealthyAccountPool(env, overrides = {}) {
  assertBindings(env);

  for (let i = 0; i < ENSURE_POOL_MAX_ATTEMPTS; i++) {
    const n = await countHealthyAccounts(env);
    if (n >= POOL_TARGET_COUNT) {
      return;
    }

    try {
      const { record, detailJson } = await loginAndFetchDetail(env, overrides);
      await upsertAccount(env, record, detailJson);
      if (shouldDeleteAccountForCredits(record)) {
        await deleteAccountById(env, record.id);
      }
    } catch (error) {
      console.error("ensureHealthyAccountPool sync attempt failed", error);
    }
  }
}

export async function syncSwapfacesAccount(env, overrides = {}) {
  const { token, record, detailJson } = await loginAndFetchDetail(env, overrides);
  const accountKept = await persistDetailThenMaintainPool(env, record, detailJson, overrides);

  return {
    token,
    record,
    accountKept
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
    const kept = await persistDetailThenMaintainPool(env, record, detailJson, {});

    if (kept) {
      await logSync(env, record.id, source);
    }
  } catch (error) {
    console.error(`Failed to refresh account after ${source}`, error);
  }
}
