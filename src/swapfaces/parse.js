export function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function pickDefined(source, keys) {
  const output = {};

  for (const key of keys) {
    if (source[key] !== undefined) {
      output[key] = source[key];
    }
  }

  return output;
}

export function stringOrNull(value) {
  return typeof value === "string" ? value : null;
}

export function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function extractToken(payload) {
  const candidates = [
    payload?.token,
    payload?.data?.token,
    payload?.data?.accessToken,
    payload?.data?.jwt,
    payload?.result?.token
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate) {
      return candidate;
    }
  }

  return findStringValue(payload, new Set(["token", "accessToken", "jwt"]));
}

export function extractAccount(payload) {
  const directCandidates = [payload?.data, payload?.result, payload];

  for (const candidate of directCandidates) {
    if (looksLikeAccount(candidate)) {
      return candidate;
    }
  }

  return findObject(payload, looksLikeAccount);
}

export function looksLikeAccount(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  return ["id", "platform", "website"].every((key) => key in value);
}

export function normalizeRecord(account, token) {
  return {
    id: Number(account.id),
    platform: stringOrNull(account.platform),
    externalId: stringOrNull(account.externalId),
    username: stringOrNull(account.username),
    credits: numberOrNull(account.credits),
    website: stringOrNull(account.website),
    token
  };
}

function findStringValue(value, allowedKeys) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const result = findStringValue(item, allowedKeys);
      if (result) {
        return result;
      }
    }
    return null;
  }

  if (!isPlainObject(value)) {
    return null;
  }

  for (const [key, entry] of Object.entries(value)) {
    if (allowedKeys.has(key) && typeof entry === "string" && entry) {
      return entry;
    }
  }

  for (const entry of Object.values(value)) {
    const result = findStringValue(entry, allowedKeys);
    if (result) {
      return result;
    }
  }

  return null;
}

function findObject(value, predicate) {
  if (predicate(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const result = findObject(item, predicate);
      if (result) {
        return result;
      }
    }
    return null;
  }

  if (!isPlainObject(value)) {
    return null;
  }

  for (const entry of Object.values(value)) {
    const result = findObject(entry, predicate);
    if (result) {
      return result;
    }
  }

  return null;
}
