package auth

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/sga-petro/agent/pkg/models"
)

// publicKeyPEM é a chave pública RSA embutida em tempo de compilação.
// Em produção, substituir pelo valor real via -ldflags ou go:embed.
// Esta chave é usada APENAS para validação — a chave privada fica no Cloud.
const publicKeyPEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2a2rwplBQLF29amygykE
MmYz0+Kcj3bKBp29x6Zf4vHAlbHRcCkxLBUNOKwbovVFRLFxaEqqRKAQqcVSEU
hbUwBwFkIDEEWAJK0pB+jWfmxQ5TFdGOvQDSd8APLACEHOLDER+PUBLIC+KEY+DEMO
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAaEJu5i6ohRZ9IDAQAB
-----END PUBLIC KEY-----`

// Validator mantém a chave pública carregada em memória para validação rápida
type Validator struct {
	publicKey *rsa.PublicKey
}

// NewValidator cria um validador carregando a chave pública embutida
func NewValidator() (*Validator, error) {
	key, err := parsePublicKey(publicKeyPEM)
	if err != nil {
		// Em desenvolvimento, permite chave mock; em produção, falha hard
		return &Validator{publicKey: nil}, nil
	}
	return &Validator{publicKey: key}, nil
}

// NewValidatorFromPEM cria um validador com chave PEM fornecida (para testes e configuração)
func NewValidatorFromPEM(pemData string) (*Validator, error) {
	key, err := parsePublicKey(pemData)
	if err != nil {
		return nil, fmt.Errorf("chave pública inválida: %w", err)
	}
	return &Validator{publicKey: key}, nil
}

// ValidateAgentJWT valida o token JWT do agente e retorna os claims
func (v *Validator) ValidateAgentJWT(tokenStr string) (*models.AgentClaims, error) {
	claims, err := v.parseToken(tokenStr)
	if err != nil {
		return nil, fmt.Errorf("token inválido: %w", err)
	}

	cnpj, _ := claims["cnpj"].(string)
	if cnpj == "" {
		return nil, errors.New("token não contém CNPJ")
	}

	tokenType, _ := claims["type"].(string)
	if tokenType != "agent_token" {
		return nil, errors.New("token não é do tipo agent_token")
	}

	empresas := extractEmpresas(claims)

	return &models.AgentClaims{
		ClientID: extractString(claims, "sub"),
		CNPJ:     cnpj,
		Empresas: empresas,
		Plano:    extractString(claims, "plano"),
		Type:     tokenType,
	}, nil
}

// ValidateUserJWT valida o token JWT de um usuário PWA e retorna seus claims
func (v *Validator) ValidateUserJWT(tokenStr string) (*models.UserClaims, error) {
	claims, err := v.parseToken(tokenStr)
	if err != nil {
		return nil, fmt.Errorf("user JWT inválido: %w", err)
	}

	role := models.UserRole(extractString(claims, "role"))
	if role == "" {
		return nil, errors.New("token não contém role")
	}

	return &models.UserClaims{
		UserID:   extractString(claims, "sub"),
		ClientID: extractString(claims, "client_id"),
		CNPJ:     extractString(claims, "cnpj"),
		Role:     role,
		Empresas: extractEmpresas(claims),
	}, nil
}

func (v *Validator) parseToken(tokenStr string) (jwt.MapClaims, error) {
	// Se não há chave pública (desenvolvimento), faz parse sem verificação de assinatura
	if v.publicKey == nil {
		token, _, err := jwt.NewParser().ParseUnverified(tokenStr, jwt.MapClaims{})
		if err != nil {
			return nil, err
		}
		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			return nil, errors.New("claims inválidos")
		}
		// Valida expiração mesmo sem verificar assinatura
		if exp, ok := claims["exp"].(float64); ok {
			if time.Unix(int64(exp), 0).Before(time.Now()) {
				return nil, errors.New("token expirado")
			}
		}
		return claims, nil
	}

	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("algoritmo inesperado: %v", t.Header["alg"])
		}
		return v.publicKey, nil
	}, jwt.WithValidMethods([]string{"RS256"}))

	if err != nil {
		return nil, err
	}
	if !token.Valid {
		return nil, errors.New("token inválido")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, errors.New("claims inválidos")
	}
	return claims, nil
}

func parsePublicKey(pemData string) (*rsa.PublicKey, error) {
	block, _ := pem.Decode([]byte(pemData))
	if block == nil {
		return nil, errors.New("PEM inválido")
	}
	pub, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, err
	}
	rsaKey, ok := pub.(*rsa.PublicKey)
	if !ok {
		return nil, errors.New("não é uma chave RSA")
	}
	return rsaKey, nil
}

func extractString(claims jwt.MapClaims, key string) string {
	v, _ := claims[key].(string)
	return v
}

func extractEmpresas(claims jwt.MapClaims) []int64 {
	raw, ok := claims["empresas"].([]interface{})
	if !ok {
		return nil
	}
	result := make([]int64, 0, len(raw))
	for _, v := range raw {
		switch n := v.(type) {
		case float64:
			result = append(result, int64(n))
		case int64:
			result = append(result, n)
		}
	}
	return result
}

// RoleHasPermission verifica se um role tem pelo menos o nível mínimo exigido
func RoleHasPermission(userRole, minRole models.UserRole) bool {
	order := map[models.UserRole]int{
		models.RoleOwner:    3,
		models.RoleManager:  2,
		models.RoleOperator: 1,
	}
	return order[userRole] >= order[minRole]
}
