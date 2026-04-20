import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import * as XLSX from 'xlsx'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

type ParsedRow = {
  rowIndex: number
  unitNoOriginal: string
  unitNo: string
  unitType: string
  contractStart: string
  contractEnd: string
  currentRent: number
  status: 'Occupied' | 'Vacant'
  tower: string
  warnings: string[]
  errors: string[]
}

// Normalises unit types found in Excel to the vocabulary the app uses
// (the "Add Single Unit" modal dropdown: Studio / 1 BHK / 2 BHK / 3 BHK / Shop / Office).
const UNIT_TYPE_MAP: Record<string, string> = {
  STUDIO: 'Studio',
  '1 BR': '1 BHK',
  '1BR': '1 BHK',
  '1 BHK': '1 BHK',
  '1BHK': '1 BHK',
  '2 BR': '2 BHK',
  '2BR': '2 BHK',
  '2 BHK': '2 BHK',
  '2BHK': '2 BHK',
  '3 BR': '3 BHK',
  '3BR': '3 BHK',
  '3 BHK': '3 BHK',
  '3BHK': '3 BHK',
  SHOP: 'Shop',
  SHOPS: 'Shop',
  OFFICE: 'Office',
  OFFICES: 'Office',
}

function extractUnitNo(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  const lastDash = trimmed.lastIndexOf('-')
  if (lastDash === -1) return trimmed
  return trimmed.slice(lastDash + 1).trim()
}

function excelSerialToIso(serial: unknown): string {
  if (serial === '' || serial === null || serial === undefined) return ''
  const n = typeof serial === 'number' ? serial : Number(serial)
  if (!Number.isFinite(n) || n <= 0) {
    if (typeof serial === 'string' && /\d{4}-\d{2}-\d{2}/.test(serial)) {
      return serial.slice(0, 10)
    }
    return ''
  }
  const excelEpoch = Date.UTC(1899, 11, 30)
  const ms = excelEpoch + n * 86400000
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return ''
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function normaliseStatus(raw: unknown): 'Occupied' | 'Vacant' {
  const s = String(raw || '').trim().toLowerCase()
  if (s === 'occupied') return 'Occupied'
  return 'Vacant'
}

function normaliseType(raw: unknown): string {
  const s = String(raw || '').trim().toUpperCase()
  if (!s) return ''
  return UNIT_TYPE_MAP[s] ?? String(raw).trim()
}

function parseWorkbook(buffer: ArrayBuffer): ParsedRow[] {
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' })

  const out: ParsedRow[] = []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || []
    if (typeof row[0] !== 'number') continue
    const unitNoOriginal = String(row[2] || '').trim()
    out.push({
      rowIndex: i + 1,
      unitNoOriginal,
      unitNo: extractUnitNo(unitNoOriginal),
      unitType: normaliseType(row[5]),
      contractStart: excelSerialToIso(row[3]),
      contractEnd: excelSerialToIso(row[4]),
      currentRent: Number.isFinite(Number(row[6])) ? Number(row[6]) : 0,
      status: normaliseStatus(row[7]),
      tower: String(row[1] || '').trim(),
      warnings: [],
      errors: [],
    })
  }
  return out
}

function isDateLike(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

function validate(rows: ParsedRow[], existingUnitNos: Set<string>): ParsedRow[] {
  const seen = new Map<string, number>()
  const validated = rows.map((r) => ({
    ...r,
    warnings: [] as string[],
    errors: [] as string[],
  }))

  for (const r of validated) {
    if (!r.unitNo) {
      r.errors.push('Unit number is empty')
      continue
    }
    seen.set(r.unitNo, (seen.get(r.unitNo) || 0) + 1)
  }
  for (const r of validated) {
    if (!r.unitNo) continue
    if ((seen.get(r.unitNo) || 0) > 1) {
      r.errors.push(`Duplicate unitNo "${r.unitNo}" in this Excel`)
    }
    if (existingUnitNos.has(r.unitNo)) {
      r.errors.push(`Unit "${r.unitNo}" already exists in this organization`)
    }
  }

  for (const r of validated) {
    if (r.contractStart && !isDateLike(r.contractStart)) {
      r.errors.push(`Invalid start date "${r.contractStart}" (expected YYYY-MM-DD)`)
    }
    if (r.contractEnd && !isDateLike(r.contractEnd)) {
      r.errors.push(`Invalid end date "${r.contractEnd}" (expected YYYY-MM-DD)`)
    }
    if (r.contractStart && r.contractEnd && r.contractStart > r.contractEnd) {
      r.errors.push('Contract start is after contract end')
    }
    if (r.currentRent < 0) {
      r.errors.push('Rent cannot be negative')
    }
    if (r.status !== 'Occupied' && r.status !== 'Vacant') {
      r.errors.push(`Invalid status "${r.status}"`)
    }

    if (!r.unitType) r.warnings.push('Missing unit type')
    if (r.currentRent === 0) r.warnings.push('Rent is 0')
    if (r.status === 'Occupied' && (!r.contractStart || !r.contractEnd)) {
      r.warnings.push('Occupied unit has no contract dates')
    }
  }
  return validated
}

function summarise(rows: ParsedRow[]) {
  const errorCount = rows.filter((r) => r.errors.length > 0).length
  const warningCount = rows.filter((r) => r.warnings.length > 0).length
  return {
    totalRows: rows.length,
    blocking: errorCount,
    warnings: warningCount,
    willCreate: rows.length - errorCount,
    byStatus: {
      Occupied: rows.filter((r) => r.status === 'Occupied').length,
      Vacant: rows.filter((r) => r.status === 'Vacant').length,
    },
  }
}

async function loadExistingUnitNos(organizationId: string, unitNos: string[]) {
  if (unitNos.length === 0) return new Set<string>()
  const existing = await prisma.unit.findMany({
    where: { organizationId, unitNo: { in: unitNos } },
    select: { unitNo: true },
  })
  return new Set(existing.map((u) => u.unitNo))
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const organizationId = session.user.organizationId
    const contentType = request.headers.get('content-type') || ''

    // ── Branch A: Excel upload (multipart) ── always preview, never commit
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file')
      if (!file || !(file instanceof File)) {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
      }
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: 'File exceeds 10 MB limit' }, { status: 400 })
      }

      const buffer = await file.arrayBuffer()
      let rows: ParsedRow[]
      try {
        rows = parseWorkbook(buffer)
      } catch (e) {
        console.error('Excel parse error:', e)
        return NextResponse.json({ error: 'Could not read the Excel file' }, { status: 400 })
      }

      const unitNos = rows.map((r) => r.unitNo).filter(Boolean)
      const existing = await loadExistingUnitNos(organizationId, unitNos)
      const validated = validate(rows, existing)

      return NextResponse.json({
        preview: true,
        summary: summarise(validated),
        rows: validated,
      })
    }

    // ── Branch B: JSON payload ── re-validate (optionally commit) edited rows
    const body = await request.json().catch(() => null)
    if (!body || !Array.isArray(body.rows)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    const commit: boolean = body.commit === true

    // Sanitise incoming rows — never trust client
    const incoming: ParsedRow[] = body.rows.map((r: Partial<ParsedRow>, i: number) => ({
      rowIndex: typeof r.rowIndex === 'number' ? r.rowIndex : i + 1,
      unitNoOriginal: String(r.unitNoOriginal ?? ''),
      unitNo: String(r.unitNo ?? '').trim(),
      unitType: String(r.unitType ?? '').trim(),
      contractStart: String(r.contractStart ?? '').trim(),
      contractEnd: String(r.contractEnd ?? '').trim(),
      currentRent: Number.isFinite(Number(r.currentRent)) ? Number(r.currentRent) : 0,
      status: r.status === 'Occupied' ? 'Occupied' : 'Vacant',
      tower: String(r.tower ?? '').trim(),
      warnings: [],
      errors: [],
    }))

    const existing = await loadExistingUnitNos(
      organizationId,
      incoming.map((r) => r.unitNo).filter(Boolean),
    )
    const validated = validate(incoming, existing)
    const summary = summarise(validated)

    if (!commit) {
      return NextResponse.json({ preview: true, summary, rows: validated })
    }

    if (summary.blocking > 0) {
      return NextResponse.json(
        {
          error: 'Refusing to import: blocking errors present.',
          summary,
          rows: validated,
        },
        { status: 400 },
      )
    }

    const toCreate = validated.filter((r) => r.errors.length === 0)

    const created = await prisma.$transaction(
      toCreate.map((r) =>
        prisma.unit.create({
          data: {
            organizationId,
            unitNo: r.unitNo,
            unitType: r.unitType,
            contractStart: r.contractStart,
            contractEnd: r.contractEnd,
            currentRent: r.currentRent,
            status: r.status,
            notes: r.unitNoOriginal && r.unitNoOriginal !== r.unitNo
              ? `Imported from "${r.unitNoOriginal}"`
              : '',
          },
        }),
      ),
    )

    await logActivity(
      organizationId,
      session.user.name || session.user.email || 'unknown',
      'Imported units from Excel',
      `Rows: ${created.length}`,
    )

    return NextResponse.json({
      preview: false,
      committed: true,
      createdCount: created.length,
      summary,
    })
  } catch (error) {
    console.error('POST /api/import/units error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
