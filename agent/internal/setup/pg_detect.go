package setup

import (
	"database/sql"
	"fmt"
	"net"
	"time"

	_ "github.com/lib/pq"
)

// PGResult é o resultado da auto-detecção do PostgreSQL.
type PGResult struct {
	Host    string
	Port    int
	Version string // ex: "PostgreSQL 14.5"
}

// DetectPostgres varre as portas mais comuns e retorna onde o PostgreSQL está escutando.
// Apenas verifica conexão TCP — não precisa de credenciais.
func DetectPostgres() *PGResult {
	hosts := []string{"localhost", "127.0.0.1"}
	ports := []int{5432, 5433, 5434, 5435, 5436}

	for _, host := range hosts {
		for _, port := range ports {
			addr := fmt.Sprintf("%s:%d", host, port)
			conn, err := net.DialTimeout("tcp", addr, 1*time.Second)
			if err != nil {
				continue
			}
			conn.Close()
			return &PGResult{Host: host, Port: port}
		}
	}
	return nil
}

// TestPGConnection testa uma conexão completa com credenciais e retorna a versão.
func TestPGConnection(host string, port int, dbName, user, password string) (string, error) {
	dsn := fmt.Sprintf(
		"host=%s port=%d dbname=%s user=%s password=%s sslmode=disable connect_timeout=5",
		host, port, dbName, user, password,
	)
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return "", err
	}
	defer db.Close()

	db.SetConnMaxLifetime(5 * time.Second)

	var version string
	err = db.QueryRow("SELECT version()").Scan(&version)
	if err != nil {
		return "", err
	}

	// Retorna só "PostgreSQL 14.5" sem o resto
	if len(version) > 20 {
		version = version[:20]
	}
	return version, nil
}
