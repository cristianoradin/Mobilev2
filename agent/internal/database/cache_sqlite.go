package database

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	_ "modernc.org/sqlite"
)

// CacheDB gerencia o banco SQLite local de cache e auditoria
type CacheDB struct {
	db *sql.DB
}

// NewCacheDB abre (ou cria) o banco SQLite e aplica o schema
func NewCacheDB(path string) (*CacheDB, error) {
	db, err := sql.Open("sqlite", path+"?_journal=WAL&_timeout=5000&_fk=true")
	if err != nil {
		return nil, fmt.Errorf("abrindo sqlite: %w", err)
	}

	db.SetMaxOpenConns(1) // SQLite é single-writer
	db.SetMaxIdleConns(1)

	c := &CacheDB{db: db}
	if err := c.migrate(); err != nil {
		return nil, fmt.Errorf("migrando sqlite: %w", err)
	}
	return c, nil
}

func (c *CacheDB) migrate() error {
	schema := `
	CREATE TABLE IF NOT EXISTS grafico_cache (
		id          TEXT PRIMARY KEY,
		nome        TEXT,
		resultado   TEXT NOT NULL,
		atualizado  INTEGER NOT NULL,
		expires_at  INTEGER NOT NULL
	);

	CREATE TABLE IF NOT EXISTS audit_log (
		id          INTEGER PRIMARY KEY AUTOINCREMENT,
		timestamp   INTEGER NOT NULL,
		user_id     TEXT NOT NULL,
		user_role   TEXT NOT NULL,
		acao        TEXT NOT NULL,
		tabela      TEXT,
		registro_id TEXT,
		valor_antes TEXT,
		valor_depois TEXT,
		ip_origem   TEXT,
		status      TEXT NOT NULL
	);
	CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp DESC);

	CREATE TABLE IF NOT EXISTS user_permissions (
		user_id     TEXT PRIMARY KEY,
		role        TEXT NOT NULL,
		permissoes  TEXT NOT NULL,
		synced_at   INTEGER NOT NULL
	);

	CREATE TABLE IF NOT EXISTS chart_templates (
		id         TEXT PRIMARY KEY,
		metadata   TEXT NOT NULL,
		updated_at INTEGER NOT NULL
	);
	`
	_, err := c.db.Exec(schema)
	return err
}

// SetCache salva ou atualiza o resultado de uma query no cache
func (c *CacheDB) SetCache(templateID string, nome string, data []map[string]interface{}, maxAgeMinutes int) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return err
	}
	now := time.Now().Unix()
	expiresAt := time.Now().Add(time.Duration(maxAgeMinutes) * time.Minute).Unix()

	_, err = c.db.Exec(`
		INSERT INTO grafico_cache (id, nome, resultado, atualizado, expires_at)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			nome=excluded.nome,
			resultado=excluded.resultado,
			atualizado=excluded.atualizado,
			expires_at=excluded.expires_at
	`, templateID, nome, string(jsonData), now, expiresAt)
	return err
}

// CacheResult contém o resultado do cache com metadados de frescor
type CacheResult struct {
	Data      []map[string]interface{}
	AgeSeconds int64
	Expired   bool
}

// GetCache busca o resultado cacheado de um template
func (c *CacheDB) GetCache(templateID string) (*CacheResult, error) {
	var resultado string
	var atualizado, expiresAt int64

	err := c.db.QueryRow(`
		SELECT resultado, atualizado, expires_at FROM grafico_cache WHERE id = ?
	`, templateID).Scan(&resultado, &atualizado, &expiresAt)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	var data []map[string]interface{}
	if err := json.Unmarshal([]byte(resultado), &data); err != nil {
		return nil, err
	}

	now := time.Now().Unix()
	return &CacheResult{
		Data:       data,
		AgeSeconds: now - atualizado,
		Expired:    now > expiresAt,
	}, nil
}

// WriteAuditLog grava um registro de auditoria — imutável (sem UPDATE/DELETE)
func (c *CacheDB) WriteAuditLog(entry AuditEntry) error {
	var valorAntes, valorDepois string
	if entry.ValorAntes != nil {
		b, _ := json.Marshal(entry.ValorAntes)
		valorAntes = string(b)
	}
	if entry.ValorDepois != nil {
		b, _ := json.Marshal(entry.ValorDepois)
		valorDepois = string(b)
	}

	_, err := c.db.Exec(`
		INSERT INTO audit_log
			(timestamp, user_id, user_role, acao, tabela, registro_id, valor_antes, valor_depois, ip_origem, status)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		time.Now().Unix(),
		entry.UserID, fmt.Sprintf("%v", entry.UserRole), entry.Acao,
		entry.Tabela, entry.RegistroID,
		valorAntes, valorDepois, entry.IPOrigem, entry.Status,
	)
	return err
}

// AuditEntry dados para gravar no audit log
type AuditEntry struct {
	UserID      string
	UserRole    interface{}
	Acao        string
	Tabela      string
	RegistroID  string
	ValorAntes  interface{}
	ValorDepois interface{}
	IPOrigem    string
	Status      string
}

// SaveTemplate persiste o metadata de um template no cache local
func (c *CacheDB) SaveTemplate(id string, metadata []byte) error {
	_, err := c.db.Exec(`
		INSERT INTO chart_templates (id, metadata, updated_at)
		VALUES (?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET metadata=excluded.metadata, updated_at=excluded.updated_at
	`, id, string(metadata), time.Now().Unix())
	return err
}

// GetTemplate recupera o metadata de um template do cache local
func (c *CacheDB) GetTemplate(id string) ([]byte, error) {
	var metadata string
	err := c.db.QueryRow(`SELECT metadata FROM chart_templates WHERE id = ?`, id).Scan(&metadata)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return []byte(metadata), err
}

// Vacuum compacta o banco e remove entradas expiradas
func (c *CacheDB) Vacuum() error {
	_, err := c.db.Exec(`DELETE FROM grafico_cache WHERE expires_at < ?`, time.Now().Unix())
	if err != nil {
		return err
	}
	_, err = c.db.Exec(`VACUUM`)
	return err
}

// Close fecha a conexão com o banco
func (c *CacheDB) Close() error {
	return c.db.Close()
}
