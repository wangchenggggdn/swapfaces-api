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
