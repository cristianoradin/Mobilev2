-- ─── 04_usuarios_global.sql ─────────────────────────────────────────────────
-- Torna o email de usuário mobile globalmente único (não apenas por cliente).
-- Rodar MANUALMENTE no servidor após o deploy do portal.
-- Idempotente: seguro de re-executar.

BEGIN;

-- Passo 1: desativar e renomear e-mails duplicados (mantém o mais recente por email)
UPDATE usuarios u1
SET    email = email || '_DEDUP_' || left(id::text, 8),
       ativo = false
WHERE  created_at < (
  SELECT MAX(u2.created_at)
  FROM   usuarios u2
  WHERE  lower(u2.email) = lower(u1.email)
    AND  u2.id <> u1.id
)
AND NOT (email LIKE '%_DEDUP_%');

-- Passo 2: remover constraint antiga (única por cliente+email)
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_cliente_id_email_key;

-- Passo 3: adicionar constraint global de email único
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE  conname = 'usuarios_email_key'
      AND  conrelid = 'usuarios'::regclass
  ) THEN
    ALTER TABLE usuarios ADD CONSTRAINT usuarios_email_key UNIQUE (email);
  END IF;
END$$;

COMMIT;

-- Verificação:
-- SELECT email, count(*) FROM usuarios GROUP BY email HAVING count(*) > 1;
