package database

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	_ "github.com/lib/pq"
	"github.com/sga-petro/agent/internal/config"
)

// PostgresDB gerencia o pool de conexões ao banco local do cliente
type PostgresDB struct {
	readOnly *sql.DB // usuário read-only para SELECT
	readWrite *sql.DB // usuário limitado para UPDATE controlado
}

// NewPostgresDB cria pools de conexão com o PostgreSQL local
func NewPostgresDB(cfg config.DatabaseConfig) (*PostgresDB, error) {
	dsn := fmt.Sprintf(
		"host=%s port=%d dbname=%s user=%s password=%s sslmode=%s connect_timeout=10",
		cfg.Host, cfg.Port, cfg.Name, cfg.User, cfg.Password, cfg.SSLMode,
	)

	readOnly, err := openPool(dsn, cfg.MaxConnections)
	if err != nil {
		return nil, fmt.Errorf("conectando PostgreSQL: %w", err)
	}

	return &PostgresDB{readOnly: readOnly}, nil
}

func openPool(dsn string, maxConns int) (*sql.DB, error) {
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, err
	}

	db.SetMaxOpenConns(maxConns)
	db.SetMaxIdleConns(2)
	db.SetConnMaxLifetime(30 * time.Minute)
	db.SetConnMaxIdleTime(5 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("ping PostgreSQL: %w", err)
	}

	return db, nil
}

// QueryContext executa uma query SELECT com timeout e retorna as linhas como maps
func (p *PostgresDB) QueryContext(ctx context.Context, query string, args ...interface{}) ([]map[string]interface{}, error) {
	rows, err := p.readOnly.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("executando query: %w", err)
	}
	defer rows.Close()

	cols, err := rows.Columns()
	if err != nil {
		return nil, err
	}

	var result []map[string]interface{}
	for rows.Next() {
		values := make([]interface{}, len(cols))
		valuePtrs := make([]interface{}, len(cols))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			return nil, err
		}

		row := make(map[string]interface{}, len(cols))
		for i, col := range cols {
			val := values[i]
			// Converte []byte para string para serialização JSON limpa
			if b, ok := val.([]byte); ok {
				val = string(b)
			}
			row[col] = val
		}
		result = append(result, row)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return result, nil
}

// ExecWrite executa um comando de escrita (UPDATE) com contexto de auditoria
// Usa transação para garantir rollback em caso de erro
func (p *PostgresDB) ExecWrite(ctx context.Context, query string, args ...interface{}) (int64, error) {
	if p.readWrite == nil {
		return 0, fmt.Errorf("conexão de escrita não configurada")
	}

	tx, err := p.readWrite.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return 0, err
	}
	defer tx.Rollback() //nolint:errcheck

	result, err := tx.ExecContext(ctx, query, args...)
	if err != nil {
		return 0, fmt.Errorf("executando escrita: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return 0, err
	}

	return affected, tx.Commit()
}

// Ping verifica a conectividade com o banco
func (p *PostgresDB) Ping(ctx context.Context) error {
	return p.readOnly.PingContext(ctx)
}

// Close fecha todos os pools de conexão
func (p *PostgresDB) Close() {
	if p.readOnly != nil {
		p.readOnly.Close()
	}
	if p.readWrite != nil {
		p.readWrite.Close()
	}
}
