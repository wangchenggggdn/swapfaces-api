export async function getRandomAccount(env) {
  return env.DB.prepare(
    `SELECT id, token FROM swapfaces_accounts ORDER BY RANDOM() LIMIT 1`
  ).first();
}

export async function upsertAccount(env, record, detailPayload) {
  await env.DB.prepare(
    `INSERT INTO swapfaces_accounts (
      id,
      platform,
      external_id,
      username,
      credits,
      website,
      token,
      raw_detail,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      platform = excluded.platform,
      external_id = excluded.external_id,
      username = excluded.username,
      credits = excluded.credits,
      website = excluded.website,
      token = excluded.token,
      raw_detail = excluded.raw_detail,
      updated_at = datetime('now')`
  )
    .bind(
      record.id,
      record.platform,
      record.externalId,
      record.username,
      record.credits,
      record.website,
      record.token,
      JSON.stringify(detailPayload)
    )
    .run();
}

/** 账号 credits 大于该值才算「健康」，计入池子目标数量 */
export const POOL_MIN_CREDITS_EXCLUSIVE = 30;

/** 池中至少需要这么多条健康账号 */
export const POOL_TARGET_COUNT = 10;

export async function countHealthyAccounts(env) {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS c FROM swapfaces_accounts WHERE credits > ?`
  )
    .bind(POOL_MIN_CREDITS_EXCLUSIVE)
    .first();
  return Number(row?.c ?? 0);
}

export async function deleteAccountById(env, accountId) {
  await env.DB.prepare(`DELETE FROM sync_logs WHERE account_id = ?`).bind(accountId).run();
  await env.DB.prepare(`DELETE FROM swapfaces_accounts WHERE id = ?`).bind(accountId).run();
}

export async function logSync(env, accountId, source) {
  await env.DB.prepare(
    `INSERT INTO sync_logs (account_id, source, created_at)
     VALUES (?, ?, datetime('now'))`
  )
    .bind(accountId, source)
    .run();
}

export async function insertImageTask(env, actionId, token, userId) {
  await env.DB.prepare(
    `INSERT INTO image_tasks (action_id, token, user_id, state, created_at)
     VALUES (?, ?, ?, 1, datetime('now'))`
  )
    .bind(actionId, token, userId ?? null)
    .run();
}
