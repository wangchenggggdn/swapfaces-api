CREATE TABLE IF NOT EXISTS image_tasks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  action_id  TEXT,
  token      TEXT NOT NULL,
  user_id    INTEGER,
  state      INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
