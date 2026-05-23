package query_test

import (
	"strings"
	"testing"

	"github.com/sga-petro/agent/internal/query"
)

const testCNPJ = "12.345.678/0001-99"

// TestCNPJInjectionPresent garante que o CNPJ é sempre injetado na query
func TestCNPJInjectionPresent(t *testing.T) {
	q, err := query.PrepareReadQuery(
		`SELECT data, total FROM vendas WHERE empresa_id IN (:empresas_filtradas)`,
		testCNPJ,
		[]int64{1, 2, 3},
	)
	if err != nil {
		t.Fatalf("não deveria falhar: %v", err)
	}

	// O CNPJ deve aparecer nos args (não interpolado na SQL — proteção contra injeção)
	if len(q.Args) == 0 {
		t.Fatal("Args não pode estar vazio — CNPJ deve ser passado como parâmetro")
	}

	found := false
	for _, arg := range q.Args {
		if arg == testCNPJ {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("CNPJ não encontrado nos args: %v", q.Args)
	}

	// A SQL gerada deve conter o wrapper de segurança
	if !strings.Contains(q.SQL, "_sga_secured") {
		t.Errorf("SQL não contém o wrapper de segurança: %s", q.SQL)
	}
}

// TestEmpresasPlaceholderSubstitution garante que :empresas_filtradas é substituído corretamente
func TestEmpresasPlaceholderSubstitution(t *testing.T) {
	q, err := query.PrepareReadQuery(
		`SELECT * FROM vendas WHERE empresa_id IN (:empresas_filtradas)`,
		testCNPJ,
		[]int64{10, 20, 30},
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

// TestRejectNonSelect garante que apenas SELECT é aceito no fluxo de leitura
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
		_, err := query.PrepareReadQuery(sql, testCNPJ, []int64{1})
		if err == nil {
			t.Errorf("deveria ter rejeitado SQL perigoso: %s", sql)
		}
	}
}

// TestRejectSQLComments garante que comentários são rejeitados (vetor de bypass)
func TestRejectSQLComments(t *testing.T) {
	sqlsComComentario := []string{
		`SELECT * FROM vendas WHERE empresa_id = 1 -- ignore resto`,
		`SELECT * FROM vendas /* comentário */ WHERE id = 1`,
		`SELECT * FROM vendas WHERE id = 1 /* bypass */ OR 1=1`,
	}

	for _, sql := range sqlsComComentario {
		_, err := query.PrepareReadQuery(sql, testCNPJ, []int64{1})
		if err == nil {
			t.Errorf("deveria ter rejeitado SQL com comentário: %s", sql)
		}
	}
}

// TestEmptyEmpresasList garante comportamento seguro com lista vazia de empresas
func TestEmptyEmpresasList(t *testing.T) {
	q, err := query.PrepareReadQuery(
		`SELECT * FROM vendas WHERE empresa_id IN (:empresas_filtradas)`,
		testCNPJ,
		[]int64{}, // lista vazia
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
	)
	if err != nil {
		t.Fatalf("não deveria falhar: %v", err)
	}

	// O CNPJ NÃO deve aparecer literalmente na SQL (deve ser via $N)
	if strings.Contains(q.SQL, cnpjWithSpecialChars) {
		t.Errorf("CNPJ foi interpolado diretamente na SQL — vulnerabilidade de injeção! SQL: %s", q.SQL)
	}
}
