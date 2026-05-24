/**
 * POST /api/agent/release
 * Recebe upload de um novo binário do agente, salva em /public/agent/
 * e retorna a URL de download + SHA256.
 *
 * Body: multipart/form-data
 *   file:    File   — o executável
 *   version: string — ex: "1.1.0"
 *   os:      string — "windows" | "linux" | "darwin" (default: windows)
 *   arch:    string — "amd64" | "arm64" (default: amd64)
 */
import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import { createHash } from 'crypto'
import path from 'path'
import fs from 'fs'

// Pasta onde os binários ficam acessíveis como arquivos estáticos
const AGENT_DIR = path.join(process.cwd(), 'public', 'agent')

export async function POST(req: NextRequest) {
  try {
    const form    = await req.formData()
    const file    = form.get('file')    as File   | null
    const version = form.get('version') as string | null
    const os      = (form.get('os')   as string | null) ?? 'windows'
    const arch    = (form.get('arch') as string | null) ?? 'amd64'

    if (!file || !version?.trim()) {
      return NextResponse.json(
        { error: 'file e version são obrigatórios' },
        { status: 400 }
      )
    }

    const ext = os === 'windows' ? '.exe' : ''
    const filename = `sga-agent-${version.trim()}-${os}-${arch}${ext}`

    // Garante que a pasta existe
    if (!fs.existsSync(AGENT_DIR)) {
      fs.mkdirSync(AGENT_DIR, { recursive: true })
    }

    // Lê o arquivo e calcula SHA256
    const buffer = Buffer.from(await file.arrayBuffer())
    const sha256 = createHash('sha256').update(buffer).digest('hex')

    // Salva em /public/agent/{filename}
    await writeFile(path.join(AGENT_DIR, filename), buffer)

    // URL pública: servida pelo Next.js como arquivo estático
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
      ?? `https://mobilev2.gruposgapetro.com.br:4444`

    const url = `${baseUrl}/agent/${filename}`

    return NextResponse.json({
      ok:       true,
      filename,
      url,
      sha256,
      version:  version.trim(),
      os,
      arch,
      size:     buffer.length,
    }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/agent/release]', err)
    return NextResponse.json({ error: 'Erro ao salvar binário' }, { status: 500 })
  }
}

/**
 * GET /api/agent/release
 * Lista todos os binários disponíveis.
 */
export async function GET() {
  try {
    if (!fs.existsSync(AGENT_DIR)) {
      return NextResponse.json({ releases: [] })
    }

    const files = fs.readdirSync(AGENT_DIR)
      .filter(f => f.startsWith('sga-agent-'))
      .map(f => {
        const full   = path.join(AGENT_DIR, f)
        const stat   = fs.statSync(full)
        const buffer = fs.readFileSync(full)
        const sha256 = createHash('sha256').update(buffer).digest('hex')

        // Extrai versão do nome: sga-agent-{version}-{os}-{arch}[.exe]
        const match = f.match(/^sga-agent-(.+?)-(windows|linux|darwin)-(amd64|arm64)/)
        return {
          filename: f,
          version:  match?.[1] ?? 'unknown',
          os:       match?.[2] ?? 'unknown',
          arch:     match?.[3] ?? 'unknown',
          sha256,
          size:     stat.size,
          url:      `/agent/${f}`,
        }
      })
      .sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))

    return NextResponse.json({ releases: files })
  } catch (err) {
    console.error('[GET /api/agent/release]', err)
    return NextResponse.json({ releases: [] })
  }
}
