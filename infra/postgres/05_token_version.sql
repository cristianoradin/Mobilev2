-- ─── 05_token_version.sql ────────────────────────────────────────────────────
-- Adiciona token_version à tabela usuarios para suporte a revogação de JWT.
-- Incrementar token_version invalida todos os tokens antigos daquele usuário.
-- Idempotente: seguro de re-executar.

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 1;

-- Índice para lookup rápido na validação de tokens
CREATE INDEX IF NOT EXISTS idx_usuarios_token_version ON usuarios(id, token_version) WHERE ativo = true;
