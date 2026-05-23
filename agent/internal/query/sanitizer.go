package query

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
)

var (
	// Padrão para detectar comandos perigosos (DML/DDL proibidos no fluxo de leitura)
	dangerousPattern = regexp.MustCompile(`(?i)\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE|EXEC|EXECUTE|CALL|MERGE)\b`)

	// Detecta tentativas de comentário SQL (possível vetor de injeção)
	commentPattern = regexp.MustCompile(`(/\*|\*/|--)`)

	// Placeholder multiempresa
	empresasPlaceholder = ":empresas_filtradas"
)

// SanitizedQuery contém a query processada e os argumentos preparados
type SanitizedQuery struct {
	SQL  string
	Args []interface{}
}

// PrepareReadQuery valida e prepara uma query SELECT para execução segura.
// Injeta o CNPJ do cliente e substitui o placeholder de empresas.
// Esta função é a barreira de segurança crítica — falha em qualquer dúvida.
func PrepareReadQuery(rawSQL, cnpj string, empresaIDs []int64) (*SanitizedQuery, error) {
	if rawSQL == "" {
		return nil, errors.New("SQL não pode ser vazio")
	}

	normalized := strings.TrimSpace(rawSQL)

	// Rejeita qualquer coisa que não comece com SELECT
	upper := strings.ToUpper(normalized)
	if !strings.HasPrefix(upper, "SELECT") {
		return nil, errors.New("apenas SELECT é permitido no fluxo de leitura")
	}

	// Rejeita comandos perigosos mesmo dentro de subqueries
	if dangerousPattern.MatchString(normalized) {
		return nil, errors.New("SQL contém operação proibida")
	}

	// Rejeita comentários (vetor comum de bypass de filtros)
	if commentPattern.MatchString(normalized) {
		return nil, errors.New("SQL não pode conter comentários")
	}

	// Substitui placeholder de empresas por lista inline de inteiros
	// (inteiros são seguros — não precisam de parameterização)
	empresaList := buildEmpresaList(empresaIDs)
	sql := strings.ReplaceAll(normalized, empresasPlaceholder, empresaList)

	// Injeta o filtro de CNPJ via subquery parametrizada.
	// O CNPJ é sempre passado como parâmetro ($N) — nunca interpolado diretamente.
	// Isso garante proteção contra SQL injection mesmo que o CNPJ contenha caracteres especiais.
	paramIdx := countExistingParams(sql) + 1
	wrappedSQL := fmt.Sprintf(
		`SELECT * FROM (%s) AS _sga_secured WHERE _sga_secured.cnpj_empresa = $%d`,
		sql, paramIdx,
	)

	return &SanitizedQuery{
		SQL:  wrappedSQL,
		Args: []interface{}{cnpj},
	}, nil
}

// ValidateWriteQuery valida uma query de escrita (UPDATE controlado)
// Apenas UPDATE em tabelas permitidas é aceito
func ValidateWriteQuery(rawSQL string, allowedTables []string) error {
	if rawSQL == "" {
		return errors.New("SQL não pode ser vazio")
	}

	upper := strings.TrimSpace(strings.ToUpper(rawSQL))

	// Apenas UPDATE é permitido no fluxo de escrita
	if !strings.HasPrefix(upper, "UPDATE") {
		return errors.New("apenas UPDATE é permitido no fluxo de escrita")
	}

	// Verifica se a tabela está na lista de permitidas
	tableAllowed := false
	for _, t := range allowedTables {
		if strings.Contains(upper, strings.ToUpper(t)) {
			tableAllowed = true
			break
		}
	}
	if !tableAllowed {
		return fmt.Errorf("tabela não está na lista de permitidas: %v", allowedTables)
	}

	// Rejeita subqueries e comandos múltiplos
	if strings.Count(upper, "SELECT") > 0 {
		return errors.New("UPDATE não pode conter SELECT")
	}
	if strings.Contains(normalized(rawSQL), ";") {
		return errors.New("múltiplos comandos não são permitidos")
	}

	if commentPattern.MatchString(rawSQL) {
		return errors.New("SQL não pode conter comentários")
	}

	return nil
}

func buildEmpresaList(ids []int64) string {
	if len(ids) == 0 {
		return "0" // lista vazia retorna zero que nunca vai fazer match
	}
	parts := make([]string, len(ids))
	for i, id := range ids {
		parts[i] = fmt.Sprintf("%d", id)
	}
	return strings.Join(parts, ",")
}

func countExistingParams(sql string) int {
	count := 0
	for i := 1; i <= 100; i++ {
		if strings.Contains(sql, fmt.Sprintf("$%d", i)) {
			count = i
		}
	}
	return count
}

func normalized(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}
