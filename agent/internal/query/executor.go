package query

import (
	"context"
	"fmt"
	"time"

	"go.uber.org/zap"

	"github.com/sga-petro/agent/internal/database"
)

// Executor coordena a execução de queries: sanitiza, executa, atualiza cache
type Executor struct {
	pg    *database.PostgresDB
	cache *database.CacheDB
	cnpj  string
	log   *zap.Logger
}

// NewExecutor cria um novo executor com as dependências injetadas
func NewExecutor(pg *database.PostgresDB, cache *database.CacheDB, cnpj string) *Executor {
	return &Executor{pg: pg, cache: cache, cnpj: cnpj, log: zap.NewNop()}
}

// NewExecutorWithLogger cria um executor com logger para diagnóstico
func NewExecutorWithLogger(pg *database.PostgresDB, cache *database.CacheDB, cnpj string, log *zap.Logger) *Executor {
	return &Executor{pg: pg, cache: cache, cnpj: cnpj, log: log}
}

// ExecuteReadQuery executa uma query de leitura com CNPJ injection e gestão de cache.
// Se os dados em cache ainda são válidos e forceRefresh=false, retorna do cache.
// Caso contrário, executa a query real no PostgreSQL e atualiza o cache.
//
// dateFrom e dateTo: filtro de período no formato ISO "YYYY-MM-DD". Passe "" para não substituir.
func (e *Executor) ExecuteReadQuery(
	templateID string,
	templateName string,
	rawSQL string,
	empresaIDs []int64,
	dateFrom string,
	dateTo string,
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

	// Prepara a query com CNPJ injection, empresa filter e substituição de datas
	prepared, err := PrepareReadQuery(rawSQL, e.cnpj, empresaIDs, dateFrom, dateTo)
	if err != nil {
		return nil, fmt.Errorf("sanitização: %w", err)
	}

	// Log diagnóstico: primeiros 600 chars do SQL preparado (sempre visível)
	preview := prepared.SQL
	if len(preview) > 600 {
		preview = preview[:600] + "...[truncado]"
	}
	e.log.Info("SQL preparado para execução",
		zap.String("template_id", templateID),
		zap.Int("empresa_ids_count", len(empresaIDs)),
		zap.String("sql_preview", preview),
	)

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
