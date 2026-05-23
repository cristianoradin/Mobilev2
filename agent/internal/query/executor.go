package query

import (
	"context"
	"fmt"
	"time"

	"github.com/sga-petro/agent/internal/database"
)

// Executor coordena a execução de queries: sanitiza, executa, atualiza cache
type Executor struct {
	pg    *database.PostgresDB
	cache *database.CacheDB
	cnpj  string
}

// NewExecutor cria um novo executor com as dependências injetadas
func NewExecutor(pg *database.PostgresDB, cache *database.CacheDB, cnpj string) *Executor {
	return &Executor{pg: pg, cache: cache, cnpj: cnpj}
}

// ExecuteReadQuery executa uma query de leitura com CNPJ injection e gestão de cache.
// Se os dados em cache ainda são válidos e forceRefresh=false, retorna do cache.
// Caso contrário, executa a query real no PostgreSQL e atualiza o cache.
func (e *Executor) ExecuteReadQuery(
	templateID string,
	templateName string,
	rawSQL string,
	empresaIDs []int64,
	timeoutSeconds int,
	maxCacheAgeMinutes int,
	forceRefresh bool,
) (*QueryResult, error) {

	// Verifica cache primeiro (se não for forçado refresh)
	if !forceRefresh {
		cached, err := e.cache.GetCache(templateID)
		if err == nil && cached != nil && !cached.Expired {
			return &QueryResult{
				Data:        cached.Data,
				Cached:      true,
				CacheAgeSec: cached.AgeSeconds,
				RowCount:    len(cached.Data),
			}, nil
		}
	}

	// Prepara a query com CNPJ injection e substituição de placeholders
	prepared, err := PrepareReadQuery(rawSQL, e.cnpj, empresaIDs)
	if err != nil {
		return nil, fmt.Errorf("sanitização: %w", err)
	}

	// Executa com timeout configurável
	timeout := time.Duration(timeoutSeconds) * time.Second
	if timeout == 0 {
		timeout = 30 * time.Second
	}
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	data, err := e.pg.QueryContext(ctx, prepared.SQL, prepared.Args...)
	if err != nil {
		// Se falhou mas há cache expirado, retorna o stale para não deixar o PWA sem dados
		if stale, cacheErr := e.cache.GetCache(templateID); cacheErr == nil && stale != nil {
			return &QueryResult{
				Data:        stale.Data,
				Cached:      true,
				CacheAgeSec: stale.AgeSeconds,
				RowCount:    len(stale.Data),
				Stale:       true,
			}, nil
		}
		return nil, fmt.Errorf("executando query: %w", err)
	}

	// Atualiza o cache com os novos dados
	cacheAge := maxCacheAgeMinutes
	if cacheAge == 0 {
		cacheAge = 15
	}
	_ = e.cache.SetCache(templateID, templateName, data, cacheAge)

	return &QueryResult{
		Data:     data,
		Cached:   false,
		RowCount: len(data),
	}, nil
}

// QueryResult contém o resultado de uma execução de query
type QueryResult struct {
	Data        []map[string]interface{}
	Cached      bool
	Stale       bool  // cache expirado servido como fallback
	CacheAgeSec int64
	RowCount    int
}
