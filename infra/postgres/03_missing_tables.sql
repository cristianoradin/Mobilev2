-- Migration 03: Tabelas ausentes do schema inicial
-- Execução: psql $DATABASE_URL -f 03_missing_tables.sql

-- ─── Liberações de templates do sistema ──────────────────────────────────────
-- Controla quais SYSTEM_TEMPLATES estão liberados por cliente.
-- Templates customizados usam is_publico/cliente_ids direto na tabela graficos.
CREATE TABLE IF NOT EXISTS template_liberacoes (
  template_key  VARCHAR(100) PRIMARY KEY,
  is_publico    BOOLEAN      NOT NULL DEFAULT false,
  cliente_ids   UUID[]       NOT NULL DEFAULT '{}'
);

-- ─── Liberações de dashboards do sistema ─────────────────────────────────────
-- Controla quais dashboards "sistema" (dash-001, dash-002, …) estão liberados.
-- Dashboards criados pelo portal usam is_publico/cliente_ids na tabela dashboards.
CREATE TABLE IF NOT EXISTS dashboard_liberacoes (
  dashboard_key VARCHAR(100) PRIMARY KEY,
  is_publico    BOOLEAN      NOT NULL DEFAULT false,
  cliente_ids   UUID[]       NOT NULL DEFAULT '{}'
);

-- ─── Dashboards criados pelo portal ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dashboards (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        VARCHAR(200) NOT NULL,
  descricao   TEXT,
  cor         VARCHAR(20)  NOT NULL DEFAULT '#009c3b',
  widgets     JSONB        NOT NULL DEFAULT '[]',
  is_publico  BOOLEAN      NOT NULL DEFAULT false,
  cliente_ids UUID[]       NOT NULL DEFAULT '{}',
  criado_por  UUID         REFERENCES admins(id),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dashboards_publico ON dashboards(is_publico) WHERE is_publico = true;

CREATE TRIGGER trg_dashboards_updated_at
  BEFORE UPDATE ON dashboards
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Propagandas / banners in-app ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS propagandas (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo        VARCHAR(200) NOT NULL,
  descricao     TEXT         NOT NULL DEFAULT '',
  imagem        TEXT,                               -- base64 data URL ou URL externa
  cliente_ids   UUID[]       NOT NULL DEFAULT '{}', -- vazio = vale para todos quando para_todos=true
  para_todos    BOOLEAN      NOT NULL DEFAULT false,
  duracao_horas INTEGER      NOT NULL DEFAULT 24,
  ativa         BOOLEAN      NOT NULL DEFAULT true,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_propagandas_ativa ON propagandas(ativa, expires_at);

-- ─── Push subscriptions (Web Push API) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         BIGSERIAL    PRIMARY KEY,
  cnpj       VARCHAR(14)  NOT NULL,    -- CNPJ só dígitos
  endpoint   TEXT         NOT NULL UNIQUE,
  p256dh     TEXT         NOT NULL,
  auth_key   TEXT         NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_push_cnpj ON push_subscriptions(cnpj);

-- Confirmação
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'template_liberacoes', 'dashboard_liberacoes',
    'dashboards', 'propagandas', 'push_subscriptions'
  )
ORDER BY table_name;
