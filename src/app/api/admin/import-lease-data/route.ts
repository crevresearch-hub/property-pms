import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import * as XLSX from 'xlsx'

export const maxDuration = 300

function cleanValue(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v).trim()
  if (!s || s.toUpperCase() === 'MISSING' || s === 'N/A') return ''
  return s
}

function parseDate(v: unknown): string {
  const s = cleanValue(v)
  if (!s) return ''
  // Excel serial date
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v)
    if (d) {
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${d.y}-${pad(d.m)}-${pad(d.d)}`
    }
  }
  // Already yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // dd/mm/yyyy or dd-mm-yyyy
  const m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  // yyyy/mm/dd
  const m2 = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/)
  if (m2) return `${m2[1]}-${m2[2].padStart(2, '0')}-${m2[3].padStart(2, '0')}`
  return ''
}

function parseAmount(v: unknown): number {
  if (typeof v === 'number') return v
  const s = cleanValue(v).replace(/,/g, '')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

interface LeaseRow {
  'Unit Number'?: string | number
  'Tenant Full Name'?: string
  'Tenant Email'?: string
  'Tenant Phone'?: string
  Nationality?: string
  'Date of Birth'?: string | number
  'Emirates ID Number'?: string
  'Emirates ID Expiry'?: string | number
  'Passport Number'?: string
  'Passport Expiry'?: string | number
  'Ejari Contract Number'?: string
  'Owner Name'?: string
  'Lease Start Date'?: string | number
  'Lease End Date'?: string | number
  'Annual Rent (AED)'?: string | number
  'Security Deposit (AED)'?: string | number
  'Number of Cheques'?: string | number
  [key: string]: string | number | undefined
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
    const wb = XLSX.read(buf, { type: 'buffer' })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<LeaseRow>(sheet, { defval: '' })

    const summary = {
      totalRows: rows.length,
      tenantsUpdated: 0,
      tenantsCreated: 0,
      chequesCreated: 0,
      chequesSkipped: 0,
      unitsNotFound: 0,
      errors: [] as { row: number; unitNo: string; reason: string }[],
      preview: [] as { row: number; unitNo: string; tenant: string; cheques: number; action: string }[],
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2

      const unitNo = cleanValue(row['Unit Number'])
      if (!unitNo) {
        summary.errors.push({ row: rowNum, unitNo: '', reason: 'Unit Number is empty' })
        continue
      }

      const unit = await prisma.unit.findUnique({
        where: { organizationId_unitNo: { organizationId, unitNo } },
        include: { tenant: true },
      })
      if (!unit) {
        summary.unitsNotFound++
        summary.errors.push({ row: rowNum, unitNo, reason: 'Unit not in DB' })
        summary.preview.push({ row: rowNum, unitNo, tenant: cleanValue(row['Tenant Full Name']), cheques: 0, action: 'skipped (no unit)' })
        continue
      }

      const tenantName = cleanValue(row['Tenant Full Name'])
      const phone = cleanValue(row['Tenant Phone'])
      const email = cleanValue(row['Tenant Email'])
      const nationality = cleanValue(row['Nationality'])
      const emiratesId = cleanValue(row['Emirates ID Number'])
      const emiratesIdExpiry = parseDate(row['Emirates ID Expiry'])
      const passportNo = cleanValue(row['Passport Number'])
      const passportExpiry = parseDate(row['Passport Expiry'])
      const contractStart = parseDate(row['Lease Start Date'])
      const contractEnd = parseDate(row['Lease End Date'])
      const annualRent = parseAmount(row['Annual Rent (AED)'])

      // Find or create tenant
      let tenant = unit.tenant
      if (!dryRun) {
        if (!tenant) {
          tenant = await prisma.tenant.create({
            data: {
              organizationId,
              name: tenantName || `Tenant (Unit ${unitNo})`,
              phone, email, nationality,
              emiratesId, emiratesIdExpiry,
              passportNo, passportExpiry,
            },
          })
          await prisma.unit.update({
            where: { id: unit.id },
            data: { tenantId: tenant.id, status: 'Occupied' },
          })
          summary.tenantsCreated++
        } else {
          // Update tenant fields only when the Excel has data and DB doesn't
          const updates: Record<string, string> = {}
          if (tenantName && !tenant.name) updates.name = tenantName
          else if (tenantName && tenant.name.toLowerCase() !== tenantName.toLowerCase()) updates.name = tenantName
          if (phone && !tenant.phone) updates.phone = phone
          if (email && !tenant.email) updates.email = email
          if (nationality && !tenant.nationality) updates.nationality = nationality
          if (emiratesId && !tenant.emiratesId) updates.emiratesId = emiratesId
          if (emiratesIdExpiry && !tenant.emiratesIdExpiry) updates.emiratesIdExpiry = emiratesIdExpiry
          if (passportNo && !tenant.passportNo) updates.passportNo = passportNo
          if (passportExpiry && !tenant.passportExpiry) updates.passportExpiry = passportExpiry
          if (Object.keys(updates).length > 0) {
            tenant = await prisma.tenant.update({ where: { id: tenant.id }, data: updates })
            summary.tenantsUpdated++
          }
        }

        // Update unit contract fields
        const unitUpdates: Record<string, string | number> = {}
        if (contractStart && !unit.contractStart) unitUpdates.contractStart = contractStart
        if (contractEnd && !unit.contractEnd) unitUpdates.contractEnd = contractEnd
        if (annualRent > 0 && unit.currentRent === 0) unitUpdates.currentRent = annualRent
        if (Object.keys(unitUpdates).length > 0) {
          await prisma.unit.update({ where: { id: unit.id }, data: unitUpdates })
        }
      }

      if (!tenant) {
        summary.preview.push({ row: rowNum, unitNo, tenant: tenantName, cheques: 0, action: 'would create' })
        continue
      }

      // Extract cheques (columns "Cheque 1 Number" through "Cheque 12 Number")
      let chequesThisRow = 0
      for (let n = 1; n <= 12; n++) {
        const chequeNo = cleanValue(row[`Cheque ${n} Number`])
        const chequeDate = parseDate(row[`Cheque ${n} Date`])
        const amount = parseAmount(row[`Cheque ${n} Amount`])

        if (!chequeNo && !chequeDate && !amount) continue

        if (!chequeDate || amount <= 0) {
          summary.chequesSkipped++
          summary.errors.push({ row: rowNum, unitNo, reason: `Cheque ${n}: invalid date or amount` })
          continue
        }

        if (!dryRun) {
          // Skip duplicate: same tenant + cheque no
          const existing = chequeNo
            ? await prisma.cheque.findFirst({ where: { organizationId, tenantId: tenant.id, chequeNo } })
            : null
          if (existing) {
            summary.chequesSkipped++
            continue
          }
          await prisma.cheque.create({
            data: {
              organizationId,
              tenantId: tenant.id,
              unitId: unit.id,
              chequeNo,
              chequeDate,
              amount,
              bankName: '',
              status: 'Received',
              paymentType: 'Rent',
              sequenceNo: n,
              totalCheques: parseAmount(row['Number of Cheques']) || 0,
            },
          })
          summary.chequesCreated++
          chequesThisRow++
        } else {
          chequesThisRow++
        }
      }

      summary.preview.push({
        row: rowNum,
        unitNo,
        tenant: tenantName || tenant?.name || '',
        cheques: chequesThisRow,
        action: dryRun ? 'would import' : 'imported',
      })
    }

    if (!dryRun) {
      await logActivity(
        organizationId,
        session.user.name,
        'Imported Lease Data',
        `Excel: ${summary.tenantsUpdated} tenants updated, ${summary.tenantsCreated} created, ${summary.chequesCreated} cheques created, ${summary.unitsNotFound} rows skipped`
      )
    }

    return NextResponse.json(summary)
  } catch (error) {
    console.error('POST /api/admin/import-lease-data error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
