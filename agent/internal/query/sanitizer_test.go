package query_test

import (
	"strings"
	"testing"

	"github.com/sga-petro/agent/internal/query"
)

const testCNPJ = "12.345.678/0001-99"

// TestEmpresasPlaceholderSubstitution garante que :empresas_filtradas é substituído corretamente
func TestEmpresasPlaceholderSubstitution(t *testing.T) {
	q, err := query.PrepareReadQuery(
		`SELECT * FROM vendas WHERE empresa_id IN (:empresas_filtradas)`,
		testCNPJ,
		[]int64{10, 20, 30},
		"", "",
	)
	if err != nil {
		t.Fatalf("não deveria falhar: %v", err)
	}

	if strings.Contains(q.SQL, ":empresas_filtradas") {
		t.Error("placeholder :empresas_filtradas não foi substituído")
	}

	// Deve conter os IDs reais
	for _, id := range []string{"10", "20", "30"} {
		if !strings.Contains(q.SQL, id) {
			t.Errorf("ID %s não encontrado na SQL gerada: %s", id, q.SQL)
		}
	}
}

// TestRejectNonSelect garante que apenas SELECT/WITH é aceito no fluxo de leitura
func TestRejectNonSelect(t *testing.T) {
	dangerousSQLs := []string{
		`UPDATE produtos SET preco = 1.0 WHERE id = 1`,
		`DELETE FROM vendas WHERE id = 1`,
		`DROP TABLE clientes`,
		`INSERT INTO log VALUES (1, 'hack')`,
		`TRUNCATE TABLE auditoria`,
		`ALTER TABLE users ADD COLUMN senha TEXT`,
	}

	for _, sql := range dangerousSQLs {
		_, err := query.PrepareReadQuery(sql, testCNPJ, []int64{1}, "", "")
		if err == nil {
			t.Errorf("deveria ter rejeitado SQL perigoso: %s", sql)
		}
	}
}

// TestRejectBlockComments garante que comentários de bloco /* */ são rejeitados
func TestRejectBlockComments(t *testing.T) {
	sqlsComBloco := []string{
		`SELECT * FROM vendas /* comentário */ WHERE id = 1`,
		`SELECT * FROM vendas WHERE id = 1 /* bypass */ OR 1=1`,
	}

	for _, sql := range sqlsComBloco {
		_, err := query.PrepareReadQuery(sql, testCNPJ, []int64{1}, "", "")
		if err == nil {
			t.Errorf("deveria ter rejeitado SQL com comentário de bloco: %s", sql)
		}
	}
}

// TestStripLineComments garante que comentários de linha (--) são removidos (não rejeitados)
func TestStripLineComments(t *testing.T) {
	q, err := query.PrepareReadQuery(
		`SELECT * FROM vendas WHERE empresa_id IN (:empresas_filtradas) -- filtro de segurança`,
		testCNPJ,
		[]int64{1},
		"", "",
	)
	if err != nil {
		t.Fatalf("comentário de linha deveria ser aceito (é removido): %v", err)
	}
	if strings.Contains(q.SQL, "--") {
		t.Error("comentário de linha não foi removido da SQL gerada")
	}
}

// TestEmptyEmpresasList garante comportamento seguro com lista vazia de empresas
func TestEmptyEmpresasList(t *testing.T) {
	q, err := query.PrepareReadQuery(
		`SELECT * FROM vendas WHERE empresa_id IN (:empresas_filtradas)`,
		testCNPJ,
		[]int64{}, // lista vazia
		"", "",
	)
	if err != nil {
		t.Fatalf("não deveria falhar: %v", err)
	}

	// Com lista vazia, deve usar valor que nunca fará match (empresa_id = 0)
	if !strings.Contains(q.SQL, "0") {
		t.Errorf("SQL com lista vazia deveria ter 0 como placeholder seguro")
	}
}

// TestCNPJNeverInterpolated garante que o CNPJ nunca é interpolado diretamente na SQL
func TestCNPJNeverInterpolated(t *testing.T) {
	cnpjWithSpecialChars := "12.345.678/0001-99"
	q, err := query.PrepareReadQuery(
		`SELECT * FROM vendas WHERE empresa_id IN (:empresas_filtradas)`,
		cnpjWithSpecialChars,
		[]int64{1},
		"", "",
	)
	if err != nil {
		t.Fatalf("não deveria falhar: %v", err)
	}

	// O CNPJ NÃO deve aparecer literalmente na SQL
	if strings.Contains(q.SQL, cnpjWithSpecialChars) {
		t.Errorf("CNPJ foi interpolado diretamente na SQL — vulnerabilidade de injeção! SQL: %s", q.SQL)
	}
}

// TestDateSubstitution garante que :data_inicio/:data_fim são substituídos corretamente
func TestDateSubstitution(t *testing.T) {
	q, err := query.PrepareReadQuery(
		`SELECT * FROM vendas WHERE empresa_id IN (:empresas_filtradas) AND data BETWEEN :data_inicio AND :data_fim`,
		testCNPJ,
		[]int64{1},
		"2024-01-15", "2024-01-31",
	)
	if err != nil {
		t.Fatalf("não deveria falhar: %v", err)
	}

	if strings.Contains(q.SQL, ":data_inicio") {
		t.Error(":data_inicio não foi substituído")
	}
	if strings.Contains(q.SQL, ":data_fim") {
		t.Error(":data_fim não foi substituído")
	}
	if !strings.Contains(q.SQL, "'2024-01-15'") {
		t.Errorf("data início não encontrada na SQL: %s", q.SQL)
	}
	if !strings.Contains(q.SQL, "'2024-01-31'") {
		t.Errorf("data fim não encontrada na SQL: %s", q.SQL)
	}
}

// TestDatetimeSubstitution garante que :datetime_inicio/:datetime_fim são substituídos corretamente
func TestDatetimeSubstitution(t *testing.T) {
	q, err := query.PrepareReadQuery(
		`SELECT * FROM vendas WHERE empresa_id IN (:empresas_filtradas) AND criado_em BETWEEN :datetime_inicio AND :datetime_fim`,
		testCNPJ,
		[]int64{1},
		"2024-01-15", "2024-01-31",
	)
	if err != nil {
		t.Fatalf("não deveria falhar: %v", err)
	}

	if strings.Contains(q.SQL, ":datetime_inicio") {
		t.Error(":datetime_inicio não foi substituído")
	}
	if strings.Contains(q.SQL, ":datetime_fim") {
		t.Error(":datetime_fim não foi substituído")
	}
	if !strings.Contains(q.SQL, "'2024-01-15 00:00:00'") {
		t.Errorf("datetime início esperado '2024-01-15 00:00:00' não encontrado na SQL: %s", q.SQL)
	}
	if !strings.Contains(q.SQL, "'2024-01-31 23:59:59'") {
		t.Errorf("datetime fim esperado '2024-01-31 23:59:59' não encontrado na SQL: %s", q.SQL)
	}
}

// TestDateSubstitutionEmpty garante que :data_inicio não é substituído quando dateFrom está vazio
func TestDateSubstitutionEmpty(t *testing.T) {
	q, err := query.PrepareReadQuery(
		`SELECT * FROM vendas WHERE empresa_id IN (:empresas_filtradas) AND data >= :data_inicio`,
		testCNPJ,
		[]int64{1},
		"", "", // sem datas — placeholder permanece
	)
	if err != nil {
		t.Fatalf("não deveria falhar: %v", err)
	}

	// Com datas vazias, o placeholder permanece no SQL (o chamador é responsável por tratar)
	if !strings.Contains(q.SQL, ":data_inicio") {
		t.Error(":data_inicio deveria permanecer quando dateFrom está vazio")
	}
}
