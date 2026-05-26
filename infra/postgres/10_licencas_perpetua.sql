-- ─── Permitir licença perpétua (sem data_expiracao) ─────────────────────────
-- Backend POST /api/licencas já aceita null; tabela bloqueava com NOT NULL.

ALTER TABLE licencas ALTER COLUMN data_expiracao DROP NOT NULL;
