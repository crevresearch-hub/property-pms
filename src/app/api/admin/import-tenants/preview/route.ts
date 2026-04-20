import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { readdir, stat } from 'fs/promises'
import path from 'path'

interface PreviewRow {
  folderName: string
  folderPath: string
  unitNo: string
  tenantNameFromFolder: string
  hasEidPdf: boolean
  hasEjariPdf: boolean
  hasChequesPdf: boolean
  unitFound: boolean
  unitHasTenant: boolean
  existingTenantName?: string
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const organizationId = session.user.organizationId
    const rootPath = request.nextUrl.searchParams.get('path')
    if (!rootPath) return NextResponse.json({ error: 'path is required' }, { status: 400 })

    let entries: string[]
    try {
      entries = await readdir(rootPath)
    } catch (e) {
      return NextResponse.json({ error: `Cannot read folder: ${e instanceof Error ? e.message : e}` }, { status: 400 })
    }

    const rows: PreviewRow[] = []

    for (const entry of entries) {
      const full = path.join(rootPath, entry)
      const s = await stat(full).catch(() => null)
      if (!s?.isDirectory()) continue

      const match = entry.match(/^\s*([^\s-]+)\s*-\s*(.+?)\s*$/)
      if (!match) continue
      const unitNo = match[1]
      const tenantNameFromFolder = match[2].trim()

      const files = await readdir(full).catch(() => [] as string[])
      const subdirs = new Set<string>()
      for (const f of files) {
        const st = await stat(path.join(full, f)).catch(() => null)
        if (st?.isDirectory()) subdirs.add(f.toLowerCase())
      }

      const hasSub = (name: string) => subdirs.has(name)
      const pickPdf = async (sub: string) => {
        if (!hasSub(sub)) return false
        const list = await readdir(path.join(full, sub)).catch(() => [] as string[])
        return list.some((n) => n.toLowerCase().endsWith('.pdf'))
      }

      const [hasEidPdf, hasEjariPdf, hasChequesPdf] = await Promise.all([
        pickPdf('emirates_id'),
        pickPdf('ejari'),
        pickPdf('cheques'),
      ])

      const unit = await prisma.unit.findUnique({
        where: { organizationId_unitNo: { organizationId, unitNo } },
        include: { tenant: { select: { name: true } } },
      })

      rows.push({
        folderName: entry,
        folderPath: full,
        unitNo,
        tenantNameFromFolder,
        hasEidPdf,
        hasEjariPdf,
        hasChequesPdf,
        unitFound: !!unit,
        unitHasTenant: !!unit?.tenantId,
        existingTenantName: unit?.tenant?.name,
      })
    }

    rows.sort((a, b) => a.unitNo.localeCompare(b.unitNo, undefined, { numeric: true }))
    return NextResponse.json({ rootPath, total: rows.length, rows })
  } catch (error) {
    console.error('GET /api/admin/import-tenants/preview error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
