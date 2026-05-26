-- SGA Petro — Schema PostgreSQL 16
-- Isolamento: cada query de agente é filtrada por empresa_id (tabela empresas)
-- Audit log: append-only, sem UPDATE nem DELETE

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- busca textual eficiente

-- ─── Clientes (tenants SaaS) ────────────────────────────────────────────────
CREATE TABLE clientes (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          VARCHAR(200) NOT NULL,
  cnpj          VARCHAR(18)  NOT NULL UNIQUE,
  email         VARCHAR(200) NOT NULL UNIQUE,
  telefone      VARCHAR(20),
  plano         VARCHAR(20)  NOT NULL DEFAULT 'basic'
                             CHECK (plano IN ('basic', 'pro', 'enterprise')),
  ativo         BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── Empresas (filiais por cliente) ─────────────────────────────────────────
CREATE TABLE empresas (
  id            BIGSERIAL    PRIMARY KEY,
  cliente_id    UUID         NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nome          VARCHAR(200) NOT NULL,
  cnpj_filial   VARCHAR(18)  UNIQUE,
  is_master     BOOLEAN      NOT NULL DEFAULT false,
  ativo         BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_empresas_cliente ON empresas(cliente_id);

-- ─── Usuários (usuários dos clientes) ───────────────────────────────────────
CREATE TABLE usuarios (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id    UUID         NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  email         VARCHAR(200) NOT NULL,
  nome          VARCHAR(200) NOT NULL,
  telefone      VARCHAR(20)  NOT NULL,
  role          VARCHAR(20)  NOT NULL DEFAULT 'operador'
                             CHECK (role IN ('operador', 'gerente', 'dono')),
  senha_hash    VARCHAR(200) NOT NULL,
  ativo         BOOLEAN      NOT NULL DEFAULT true,
  ultimo_login  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(cliente_id, email)
);
CREATE INDEX idx_usuarios_cliente ON usuarios(cliente_id);

-- ─── Vínculo Usuário ↔ Empresas (postos) ────────────────────────────────────
CREATE TABLE usuario_empresas (
  usuario_id UUID   NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  empresa_id BIGINT NOT NULL REFERENCES empresas(id)  ON DELETE CASCADE,
  PRIMARY KEY (usuario_id, empresa_id)
);
CREATE INDEX idx_ue_usuario ON usuario_empresas(usuario_id);
CREATE INDEX idx_ue_empresa ON usuario_empresas(empresa_id);

-- ─── Admin (usuários do portal SGA) ─────────────────────────────────────────
CREATE TABLE admins (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(200) NOT NULL UNIQUE,
  nome          VARCHAR(200) NOT NULL,
  senha_hash    VARCHAR(200) NOT NULL,
  ativo         BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── Gráficos (templates de chart) ──────────────────────────────────────────
CREATE TABLE graficos (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            VARCHAR(200) NOT NULL,
  descricao       TEXT,
  categoria       VARCHAR(50)  NOT NULL DEFAULT 'geral',
  chart_type      VARCHAR(20)  NOT NULL
                               CHECK (chart_type IN ('line','bar','pie','gauge','area',
                                                     'report','kpi','heatmap','waterfall','button','tank')),
  query_sql       TEXT         NOT NULL DEFAULT '',
  refresh_seconds INTEGER      NOT NULL DEFAULT 300,
  timeout_seconds INTEGER      NOT NULL DEFAULT 30,
  axes            JSONB        NOT NULL DEFAULT '{}',
  display         JSONB        NOT NULL DEFAULT '{}',
  permissions     JSONB        NOT NULL DEFAULT '{"min_role":"operador"}',
  is_publico      BOOLEAN      NOT NULL DEFAULT false,
  cliente_ids     UUID[]       NOT NULL DEFAULT '{}',
  kpi_config      JSONB,
  report_config   JSONB,
  button_config   JSONB,
  date_filter     JSONB,
  tank_config     JSONB,
  criado_por      UUID         REFERENCES admins(id),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_graficos_categoria ON graficos(categoria);
CREATE INDEX idx_graficos_publico   ON graficos(is_publico) WHERE is_publico = true;

-- ─── Licenças ────────────────────────────────────────────────────────────────
CREATE TABLE licencas (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id          UUID    NOT NULL REFERENCES clientes(id) ON DELETE CASCADE UNIQUE,
  plano               VARCHAR(20) NOT NULL,
  ativa               BOOLEAN NOT NULL DEFAULT true,
  data_inicio         DATE    NOT NULL DEFAULT CURRENT_DATE,
  data_expiracao      DATE    NOT NULL,
  max_usuarios        INTEGER NOT NULL DEFAULT 3,
  max_graficos        INTEGER NOT NULL DEFAULT 5,
  chave_publica_rsa   TEXT,   -- Chave pública RSA embedada no agente deste cliente
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Agentes (instâncias do agent Go nos clientes) ───────────────────────────
CREATE TABLE agentes (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id        UUID        NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nome              VARCHAR(100),
  versao            VARCHAR(20),
  ultimo_heartbeat  TIMESTAMPTZ,
  status            VARCHAR(20) NOT NULL DEFAULT 'offline'
                                CHECK (status IN ('online','offline','degraded')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_agentes_cliente ON agentes(cliente_id);

-- ─── Audit Log (append-only — sem UPDATE nem DELETE nesta tabela) ────────────
CREATE TABLE audit_log (
  id          BIGSERIAL   PRIMARY KEY,
  cliente_id  UUID        REFERENCES clientes(id),
  usuario_id  UUID        REFERENCES usuarios(id),
  acao        VARCHAR(100) NOT NULL,
  recurso     VARCHAR(200),
  payload     JSONB,
  ip_address  INET,
  status      VARCHAR(20) NOT NULL DEFAULT 'ok'
                          CHECK (status IN ('ok','warn','error')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_cliente    ON audit_log(cliente_id, created_at DESC);
CREATE INDEX idx_audit_created_at ON audit_log(created_at DESC);

-- Protege o audit_log: somente INSERT é permitido para o role da aplicação
-- (Em produção: REVOKE UPDATE, DELETE ON audit_log FROM sgapetro;)

-- ─── Trigger: atualiza updated_at automaticamente ────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_clientes_updated_at
  BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_graficos_updated_at
  BEFORE UPDATE ON graficos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
