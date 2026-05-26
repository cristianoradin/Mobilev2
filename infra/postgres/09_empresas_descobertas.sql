-- ─── Empresas descobertas pelo agente ────────────────────────────────────────
-- Agente periodicamente roda SELECT empcodigo, empnome, empcnpj FROM emp WHERE empativo=1
-- no banco local do cliente e reporta aqui. Portal pode vincular cada descoberta
-- a uma entrada em `empresas` (preenchendo codigo_erp automaticamente).

CREATE TABLE IF NOT EXISTS empresas_descobertas (
  id                   BIGSERIAL    PRIMARY KEY,
  cliente_id           UUID         NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  agent_id             UUID         REFERENCES agentes(id) ON DELETE SET NULL,
  empcodigo            BIGINT       NOT NULL,                  -- empcodigo do ERP
  empnome              VARCHAR(200) NOT NULL,
  empcnpj_clean        VARCHAR(14),                            -- só dígitos
  vinculada_empresa_id BIGINT       REFERENCES empresas(id) ON DELETE SET NULL,
  first_seen           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_seen            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  UNIQUE (cliente_id, empcodigo)
);

CREATE INDEX IF NOT EXISTS idx_emp_desc_cliente   ON empresas_descobertas (cliente_id);
CREATE INDEX IF NOT EXISTS idx_emp_desc_vinculada ON empresas_descobertas (vinculada_empresa_id);
CREATE INDEX IF NOT EXISTS idx_emp_desc_last_seen ON empresas_descobertas (last_seen DESC);
