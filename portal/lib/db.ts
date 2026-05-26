import postgres from 'postgres'

// Singleton — uma conexão por processo Node
let _sql: ReturnType<typeof postgres> | null = null

export function getDb() {
  if (!_sql) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL não configurada')
    _sql = postgres(url, {
      max:             Number(process.env.DB_POOL_MAX ?? 20),
      idle_timeout:    30,
      connect_timeout: 10,
      max_lifetime:    1800,   // recicla conexões a cada 30 min
      transform:       postgres.camel,
    })
  }
  return _sql
}

export function isDbAvailable() {
  return !!process.env.DATABASE_URL
}
