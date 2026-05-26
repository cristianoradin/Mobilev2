-- ─── 06_indexes_pool.sql ──────────────────────────────────────────────────────
-- Índices para suportar carga de 5K usuários simultâneos.
-- Idempotente: seguro de re-executar.

-- Login por email (hot path — toda autenticação PWA)
CREATE INDEX IF NOT EXISTS idx_usuarios_email_lower
  ON usuarios (lower(email))
  WHERE ativo = true;

-- Heartbeat / status do agente
CREATE INDEX IF NOT EXISTS idx_agentes_heartbeat
  ON agentes (ultimo_heartbeat DESC)
  WHERE ultimo_heartbeat IS NOT NULL;

-- Busca de agente por cliente (já existe idx_agentes_cliente — adiciona status)
CREATE INDEX IF NOT EXISTS idx_agentes_cliente_status
  ON agentes (cliente_id, status);

-- Liberações por cliente (array containment — usada em getTemplateKeysForCliente)
CREATE INDEX IF NOT EXISTS idx_template_liberacoes_publico
  ON template_liberacoes (is_publico)
  WHERE is_publico = true;

CREATE INDEX IF NOT EXISTS idx_dashboard_liberacoes_publico
  ON dashboard_liberacoes (is_publico)
  WHERE is_publico = true;

-- Gráficos com acesso liberado por array de clientes (GIN para containment @>)
CREATE INDEX IF NOT EXISTS idx_graficos_cliente_ids
  ON graficos USING GIN (cliente_ids);

-- Audit log por ação (para filtragem na tela de auditoria)
CREATE INDEX IF NOT EXISTS idx_audit_acao
  ON audit_log (acao, created_at DESC);
