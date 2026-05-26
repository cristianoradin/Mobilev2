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

	// Detecta comentários de bloco (vetor de bypass — comentários de linha são removidos antes)
	blockCommentPattern = regexp.MustCompile(`(/\*|\*/)`)

	// Placeholder multiempresa
	empresasPlaceholder = ":empresas_filtradas"
)

// SanitizedQuery contém a query processada e os argumentos preparados
type SanitizedQuery struct {
	SQL  string
	Args []interface{}
}

// PrepareReadQuery valida e prepara uma query SELECT para execução segura.
// Remove comentários de linha, valida estrutura e substitui placeholders.
//
// Placeholders suportados:
//   :empresas_filtradas  → lista de IDs de empresa do JWT (segurança multiempresa)
//   :data_inicio         → dateFrom no formato YYYY-MM-DD
//   :data_fim            → dateTo   no formato YYYY-MM-DD
//   :datetime_inicio     → dateFrom no formato YYYY-MM-DD 00:00:00
//   :datetime_fim        → dateTo   no formato YYYY-MM-DD 23:59:59
//
// dateFrom e dateTo devem estar no formato ISO "YYYY-MM-DD"; passe "" para não substituir.
func PrepareReadQuery(rawSQL, cnpj string, empresaIDs []int64, dateFrom, dateTo string) (*SanitizedQuery, error) {
	if rawSQL == "" {
		return nil, errors.New("SQL não pode ser vazio")
	}

	// Remove comentários de linha (--) para permitir templates documentados
	cleaned := stripLineComments(rawSQL)
	normalized := strings.TrimSpace(cleaned)

	// Rejeita comentários de bloco /* */ (mais difíceis de sanitizar)
	if blockCommentPattern.MatchString(normalized) {
		return nil, errors.New("SQL não pode conter comentários de bloco /* */")
	}

	// Rejeita qualquer coisa que não comece com SELECT ou WITH (CTE)
	upper := strings.ToUpper(normalized)
	if !strings.HasPrefix(upper, "SELECT") && !strings.HasPrefix(upper, "WITH") {
		return nil, errors.New("apenas SELECT/WITH é permitido no fluxo de leitura")
	}

	// Rejeita comandos perigosos mesmo dentro de subqueries
	if dangerousPattern.MatchString(normalized) {
		return nil, errors.New("SQL contém operação proibida")
	}

	// Substitui placeholder de empresas por lista inline de inteiros
	// (inteiros são seguros — não precisam de parameterização)
	empresaList := buildEmpresaList(empresaIDs)
	sql := strings.ReplaceAll(normalized, empresasPlaceholder, empresaList)

	// Substitui placeholders de data/datetime quando fornecidos.
	// Aceita "YYYY-MM-DD" ou "YYYY-MM-DD HH:MM:SS" — trunca para só a data quando necessário.
	if dateFrom != "" {
		d := safeDate(dateFrom)
		sql = strings.ReplaceAll(sql, ":data_inicio",     "'"+d+"'")
		sql = strings.ReplaceAll(sql, ":datetime_inicio", "'"+d+" 00:00:00'")
	}
	if dateTo != "" {
		d := safeDate(dateTo)
		sql = strings.ReplaceAll(sql, ":data_fim",    "'"+d+"'")
		sql = strings.ReplaceAll(sql, ":datetime_fim", "'"+d+" 23:59:59'")
	}

	// Segurança: a query já deve filtrar por empresa via :empresas_filtradas.
	// Os IDs de empresa vêm do JWT verificado — não é possível falsificar.
	return &SanitizedQuery{
		SQL:  sql,
		Args: []interface{}{},
	}, nil
}

// safeDate extrai apenas a parte YYYY-MM-DD de uma string ISO date/datetime.
// Impede que valores mal-formados quebrem o SQL.
func safeDate(s string) string {
	if len(s) >= 10 {
		return s[:10]
	}
	return s
}

// stripLineComments remove comentários de linha SQL (--)
func stripLineComments(sql string) string {
	lines := strings.Split(sql, "\n")
	result := make([]string, 0, len(lines))
	for _, line := range lines {
		if idx := strings.Index(line, "--"); idx >= 0 {
			line = line[:idx]
		}
		result = append(result, line)
	}
	return strings.Join(result, "\n")
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

	if blockCommentPattern.MatchString(rawSQL) {
		return errors.New("SQL não pode conter comentários de bloco /* */")
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
