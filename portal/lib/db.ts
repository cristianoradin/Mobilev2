import postgres from 'postgres'

// Singleton — uma conexão por processo Node
let _sql: ReturnType<typeof postgres> | null = null

export function getDb() {
  if (!_sql) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL não configurada')
    _sql = postgres(url, {
      max:         10,
      idle_timeout: 20,
      connect_timeout: 5,
      transform: postgres.camel,
    })
  }
  return _sql
}

export function isDbAvailable() {
  return !!process.env.DATABASE_URL
}
