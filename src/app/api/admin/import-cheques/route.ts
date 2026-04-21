import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import * as XLSX from 'xlsx'

export const maxDuration = 60

interface ChequeRow {
  unit_no?: string
  unitNo?: string
  'Unit No'?: string
  cheque_no?: string
  chequeNo?: string
  'Cheque No'?: string
  cheque_date?: string | number
  chequeDate?: string | number
  Date?: string | number
  amount?: string | number
  Amount?: string | number
  bank_name?: string
  bankName?: string
  'Bank Name'?: string
  Bank?: string
  status?: string
  Status?: string
  payment_type?: string
  paymentType?: string
  notes?: string
  Notes?: string
}

function pick<T extends string | number | undefined>(row: ChequeRow, keys: string[]): T {
  for (const k of keys) {
    const v = (row as Record<string, unknown>)[k]
    if (v !== undefined && v !== null && v !== '') return v as T
  }
  return undefined as T
}

function excelDateToIso(v: string | number | undefined): string {
  if (!v) return ''
  if (typeof v === 'number') {
    // Excel epoch: 1900-01-01 with leap-year bug
    const d = XLSX.SSF.parse_date_code(v)
    if (d) {
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${d.y}-${pad(d.m)}-${pad(d.d)}`
    }
  }
  const s = String(v).trim()
  // Already yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // dd-mm-yyyy or dd/mm/yyyy
  const m1 = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/)
  if (m1) return `${m1[3]}-${m1[2].padStart(2, '0')}-${m1[1].padStart(2, '0')}`
  // yyyy/mm/dd
  const m2 = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/)
  if (m2) return `${m2[1]}-${m2[2].padStart(2, '0')}-${m2[3].padStart(2, '0')}`
  return ''
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const organizationId = session.user.organizationId

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const dryRun = formData.get('dryRun') === 'true'

    if (!file) return NextResponse.json({ error: 'File is required' }, { status: 400 })

    const buf = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buf, { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<ChequeRow>(sheet, { defval: '' })

    const results = {
      total: rows.length,
      created: 0,
      skipped: 0,
      errors: [] as { row: number; unitNo: string; reason: string }[],
      preview: [] as {
        row: number
        unitNo: string
        chequeNo: string
        chequeDate: string
        amount: number
        bankName: string
        status: string
        tenantName?: string
        error?: string
      }[],
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2 // header is row 1

      const unitNo = String(pick<string>(row, ['unit_no', 'unitNo', 'Unit No', 'unit']) || '').trim()
      const chequeNo = String(pick<string>(row, ['cheque_no', 'chequeNo', 'Cheque No']) || '').trim()
      const chequeDateRaw = pick<string | number>(row, ['cheque_date', 'chequeDate', 'Date'])
      const amountRaw = pick<string | number>(row, ['amount', 'Amount'])
      const bankName = String(pick<string>(row, ['bank_name', 'bankName', 'Bank Name', 'Bank']) || '').trim()
      const status = String(pick<string>(row, ['status', 'Status']) || 'Received').trim()
      const paymentType = String(pick<string>(row, ['payment_type', 'paymentType']) || 'Rent').trim()
      const notes = String(pick<string>(row, ['notes', 'Notes']) || '').trim()

      const chequeDate = excelDateToIso(chequeDateRaw)
      const amount = typeof amountRaw === 'number' ? amountRaw : parseFloat(String(amountRaw).replace(/,/g, '')) || 0

      const p = {
        row: rowNum,
        unitNo,
        chequeNo,
        chequeDate,
        amount,
        bankName,
        status,
      }

      if (!unitNo) {
        results.errors.push({ row: rowNum, unitNo, reason: 'unit_no is required' })
        results.preview.push({ ...p, error: 'unit_no missing' })
        continue
      }
      if (!chequeDate) {
        results.errors.push({ row: rowNum, unitNo, reason: 'cheque_date invalid (use YYYY-MM-DD)' })
        results.preview.push({ ...p, error: 'bad date' })
        continue
      }
      if (!amount || amount <= 0) {
        results.errors.push({ row: rowNum, unitNo, reason: 'amount missing or 0' })
        results.preview.push({ ...p, error: 'bad amount' })
        continue
      }

      const unit = await prisma.unit.findUnique({
        where: { organizationId_unitNo: { organizationId, unitNo } },
        include: { tenant: { select: { id: true, name: true } } },
      })

      if (!unit) {
        results.errors.push({ row: rowNum, unitNo, reason: `Unit ${unitNo} not found` })
        results.preview.push({ ...p, error: 'unit not in DB' })
        continue
      }
      if (!unit.tenantId) {
        results.errors.push({ row: rowNum, unitNo, reason: `Unit ${unitNo} has no tenant assigned` })
        results.preview.push({ ...p, error: 'no tenant on unit' })
        continue
      }

      const previewEntry = { ...p, tenantName: unit.tenant?.name }
      results.preview.push(previewEntry)

      if (!dryRun) {
        try {
          await prisma.cheque.create({
            data: {
              organizationId,
              tenantId: unit.tenantId,
              unitId: unit.id,
              chequeNo,
              chequeDate,
              amount,
              bankName,
              status,
              paymentType,
              notes,
            },
          })
          results.created++
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Unknown error'
          results.errors.push({ row: rowNum, unitNo, reason: msg })
        }
      }
    }

    if (!dryRun && results.created > 0) {
      await logActivity(
        organizationId,
        session.user.name,
        'Imported Cheques',
        `Excel upload: ${results.created} cheques created, ${results.errors.length} errors`
      )
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('POST /api/admin/import-cheques error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
