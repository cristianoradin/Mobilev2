-- ─── Admin Push Subscriptions ───────────────────────────────────────────────
-- Cada admin pode ter várias inscrições (1 por dispositivo/navegador).
-- O endpoint é UNIQUE — re-inscrição idempotente via UPSERT.

CREATE TABLE IF NOT EXISTS admin_push_subscriptions (
  id          BIGSERIAL    PRIMARY KEY,
  admin_id    UUID         NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  endpoint    TEXT         NOT NULL UNIQUE,
  p256dh      TEXT         NOT NULL,
  auth_key    TEXT         NOT NULL,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  ultimo_uso  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_admin_push_admin ON admin_push_subscriptions(admin_id);
