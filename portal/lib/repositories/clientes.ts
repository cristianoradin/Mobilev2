import { getDb } from '@/lib/db'
import { MOCK_CLIENTES, type Cliente, type Plano } from '@/lib/types'

export interface CreateClienteInput {
  nome:           string
  cnpj:           string
  email:          string
  telefone?:      string
  plano:          Plano
  empresa_nome:   string          // nome da empresa/filial master
  empresa_cnpj?:  string          // cnpj_filial opcional
}

export async function listClientes(): Promise<Cliente[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT
      c.id, c.nome, c.cnpj, c.email, c.telefone, c.plano, c.ativo, c.created_at,
      COALESCE(
        json_agg(
          json_build_object('id', e.id, 'nome', e.nome, 'cnpj_filial', e.cnpj_filial, 'is_master', e.is_master)
          ORDER BY e.is_master DESC, e.nome
        ) FILTER (WHERE e.id IS NOT NULL),
        '[]'
      ) AS empresas
    FROM clientes c
    LEFT JOIN empresas e ON e.cliente_id = c.id AND e.ativo = true
    GROUP BY c.id
    ORDER BY c.nome
  `
  return rows as unknown as Cliente[]
}

export async function findCliente(id: string): Promise<Cliente | null> {
  const sql = getDb()
  const rows = await sql`
    SELECT
      c.id, c.nome, c.cnpj, c.email, c.telefone, c.plano, c.ativo, c.created_at,
      COALESCE(
        json_agg(
          json_build_object('id', e.id, 'nome', e.nome, 'cnpj_filial', e.cnpj_filial, 'is_master', e.is_master)
          ORDER BY e.is_master DESC, e.nome
        ) FILTER (WHERE e.id IS NOT NULL),
        '[]'
      ) AS empresas
    FROM clientes c
    LEFT JOIN empresas e ON e.cliente_id = c.id AND e.ativo = true
    WHERE c.id = ${id}
    GROUP BY c.id
    LIMIT 1
  `
  return (rows[0] as unknown as Cliente) ?? null
}

// Fallback para desenvolvimento sem banco
export async function listClientesSafe(): Promise<Cliente[]> {
  try {
    return await listClientes()
  } catch {
    return MOCK_CLIENTES
  }
}

export async function findClienteSafe(id: string): Promise<Cliente | null> {
  try {
    return await findCliente(id)
  } catch {
    return MOCK_CLIENTES.find(c => c.id === id) ?? null
  }
}

export async function createCliente(input: CreateClienteInput): Promise<Cliente> {
  const sql = getDb()

  // Insere cliente e empresa master em uma transação
  const rows = await sql.begin(async (tx) => {
    const [cliente] = await tx`
      INSERT INTO clientes (nome, cnpj, email, telefone, plano)
      VALUES (${input.nome}, ${input.cnpj}, ${input.email}, ${input.telefone ?? null}, ${input.plano})
      RETURNING id, nome, cnpj, email, telefone, plano, ativo, created_at
    `
    const [empresa] = await tx`
      INSERT INTO empresas (cliente_id, nome, cnpj_filial, is_master)
      VALUES (${cliente.id}, ${input.empresa_nome}, ${input.empresa_cnpj ?? null}, true)
      RETURNING id, nome, cnpj_filial, is_master
    `
    return [{ ...cliente, empresas: [empresa] }]
  })

  return rows[0] as unknown as Cliente
}

export async function createClienteSafe(input: CreateClienteInput): Promise<Cliente> {
  try {
    return await createCliente(input)
  } catch (err) {
    // Re-lança para a API tratar e retornar erro adequado ao cliente
    throw err
  }
}
