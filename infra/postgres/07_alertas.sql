-- ─── Alertas ────────────────────────────────────────────────────────────────
-- Estado dos alertas detectados pelo engine. Cada (tipo, ref_id) tem no máximo
-- 1 alerta "aberto" simultaneamente (garantido por índice parcial único).
-- Alertas "resolvidos" ficam históricos.

CREATE TABLE IF NOT EXISTS alertas (
  id            BIGSERIAL    PRIMARY KEY,
  tipo          VARCHAR(50)  NOT NULL,           -- 'agente_offline', 'licenca_expirando', 'error_rate', 'emqx_down', 'db_down'
  ref_id        VARCHAR(100) NOT NULL DEFAULT '',-- ex: id do agente, id da licença; '' para alertas globais
  severidade    VARCHAR(20)  NOT NULL DEFAULT 'warn'
                             CHECK (severidade IN ('info','warn','critical')),
  titulo        VARCHAR(200) NOT NULL,
  detalhe       TEXT,
  estado        VARCHAR(20)  NOT NULL DEFAULT 'aberto'
                             CHECK (estado IN ('aberto','resolvido')),
  criado_em     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  resolvido_em  TIMESTAMPTZ,
  ultimo_envio  TIMESTAMPTZ,                     -- usado pela Fase 2 (push) para re-arme
  envios        INTEGER      NOT NULL DEFAULT 0
);

-- Garante no máximo 1 alerta aberto por (tipo, ref_id).
CREATE UNIQUE INDEX IF NOT EXISTS uq_alertas_aberto
  ON alertas (tipo, ref_id) WHERE estado = 'aberto';

CREATE INDEX IF NOT EXISTS idx_alertas_estado_criado
  ON alertas (estado, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_alertas_criado
  ON alertas (criado_em DESC);
