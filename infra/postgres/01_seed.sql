-- Seed: admin padrão + 2 clientes de teste
-- Senha padrão: "sga@admin2026" → bcrypt (em produção gerar via script)

INSERT INTO admins (email, nome, senha_hash) VALUES (
  'admin@sgapetro.cloud',
  'Admin SGA',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TIxvHU5B.E3hhFzqXf5Nt8sG6A2e'
) ON CONFLICT DO NOTHING;

-- Cliente 1: Posto Central Ltda (plano pro)
WITH c AS (
  INSERT INTO clientes (id, nome, cnpj, email, telefone, plano)
  VALUES (
    '11111111-0001-0001-0001-000000000001',
    'Posto Central Ltda',
    '12.345.678/0001-99',
    'contato@postocentral.com.br',
    '(11) 9 9999-0001',
    'pro'
  ) ON CONFLICT DO NOTHING RETURNING id
)
INSERT INTO empresas (cliente_id, nome, cnpj_filial, is_master)
SELECT id, 'Posto Central',      '12.345.678/0001-99', true  FROM c
UNION ALL
SELECT id, 'Posto Filial Norte', '12.345.678/0002-70', false FROM c
ON CONFLICT DO NOTHING;

-- Cliente 2: Rede Petro Sul S.A. (plano enterprise)
WITH c AS (
  INSERT INTO clientes (id, nome, cnpj, email, telefone, plano)
  VALUES (
    '22222222-0002-0002-0002-000000000002',
    'Rede Petro Sul S.A.',
    '98.765.432/0001-11',
    'ti@petrosul.com.br',
    '(51) 3 3333-0002',
    'enterprise'
  ) ON CONFLICT DO NOTHING RETURNING id
)
INSERT INTO empresas (cliente_id, nome, cnpj_filial, is_master)
SELECT id, 'Petro Sul Matriz',   '98.765.432/0001-11', true  FROM c
UNION ALL
SELECT id, 'Petro Sul Filial 1', '98.765.432/0002-92', false FROM c
UNION ALL
SELECT id, 'Petro Sul Filial 2', '98.765.432/0003-73', false FROM c
ON CONFLICT DO NOTHING;

-- Licenças
INSERT INTO licencas (cliente_id, plano, data_expiracao, max_usuarios, max_graficos)
VALUES
  ('11111111-0001-0001-0001-000000000001', 'pro',        '2027-01-15', 10, 25),
  ('22222222-0002-0002-0002-000000000002', 'enterprise', '2027-02-20', 50, 100)
ON CONFLICT DO NOTHING;

-- Template de gráfico público (Vendas por Hora)
INSERT INTO graficos (nome, descricao, categoria, chart_type, query_sql, refresh_seconds, axes, display, is_publico)
VALUES (
  'Vendas por Hora',
  'Volume de vendas agrupado por hora do dia',
  'vendas',
  'area',
  'SELECT TO_CHAR(data_hora, ''HH24:00'') AS hora, SUM(valor) AS total FROM vendas WHERE empresa_id IN (:empresas_filtradas) AND data_hora >= CURRENT_DATE GROUP BY hora ORDER BY hora',
  300,
  '{"x":{"field":"hora","label":"Hora"},"y":[{"field":"total","label":"Total R$","color":"#009c3b"}]}',
  '{"height":"md","show_legend":true,"show_tooltip":true,"gradient":true}',
  true
) ON CONFLICT DO NOTHING;
