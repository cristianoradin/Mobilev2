-- Migration 02: Atualiza tabela graficos para suportar novos tipos e colunas
-- Execução: psql $DATABASE_URL -f 02_graficos_update.sql

-- 1. Remove constraint antiga de chart_type (só aceitava 5 tipos)
ALTER TABLE graficos
  DROP CONSTRAINT IF EXISTS graficos_chart_type_check;

-- 2. Adiciona todas as colunas que o código espera mas não existem no schema original
ALTER TABLE graficos
  ADD COLUMN IF NOT EXISTS cliente_ids   UUID[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS kpi_config    JSONB,
  ADD COLUMN IF NOT EXISTS report_config JSONB,
  ADD COLUMN IF NOT EXISTS button_config JSONB,
  ADD COLUMN IF NOT EXISTS date_filter   JSONB,
  ADD COLUMN IF NOT EXISTS tank_config   JSONB;

-- 3. Adiciona constraint nova que aceita todos os tipos do sistema
ALTER TABLE graficos
  ADD CONSTRAINT graficos_chart_type_check
    CHECK (chart_type IN ('line','bar','pie','gauge','area','report','kpi','heatmap','waterfall','button','tank'));

-- Confirmação
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'graficos'
ORDER BY ordinal_position;
