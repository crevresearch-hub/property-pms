import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import * as XLSX from 'xlsx'

export const maxDuration = 60

interface BankRow {
  date: string
  amount: number
  description: string
  ref: string
  rowNum: number
}

interface Match {
  bankRow: BankRow
  chequeId: string
  chequeNo: string
  chequeDate: string
  amount: number
  tenantName: string
  unitNo: string
  daysDiff: number
  score: number
}

function clean(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

function parseDate(v: unknown): string {
  const s = clean(v)
  if (!s) return ''
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v)
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return ''
}

function parseAmount(v: unknown): number {
  if (typeof v === 'number') return v
  const s = clean(v).replace(/[^\d.\-]/g, '')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : Math.abs(n)
}

function pickCol(row: Record<string, unknown>, candidates: string[]): unknown {
  const normalize = (s: string) => s.toLowerCase().replace(/[\s_\-.()]+/g, '')
  const keyMap = new Map<string, string>()
  for (const k of Object.keys(row)) keyMap.set(normalize(k), k)
  for (const c of candidates) {
    const actual = keyMap.get(normalize(c))
    if (actual !== undefined) {
      const v = row[actual]
      if (v !== undefined && v !== null && v !== '') return v
    }
  }
  return undefined
}

function daysDiff(a: string, b: string): number {
  if (!a || !b) return 999
  return Math.abs(Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86400000))
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const organizationId = session.user.organizationId
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const commit = formData.get('commit') === 'true'
    if (!file) return NextResponse.json({ error: 'File is required' }, { status: 400 })

    const buf = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buf, { type: 'buffer' })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

    // Parse bank rows
    const bankRows: BankRow[] = []
    rows.forEach((row, i) => {
      const date = parseDate(pickCol(row, ['Date', 'Transaction Date', 'Value Date', 'Txn Date']))
      const desc = clean(pickCol(row, ['Description', 'Narration', 'Details', 'Remarks', 'Reference']))
      const credit = parseAmount(pickCol(row, ['Credit', 'Deposit', 'Credit Amount', 'CR']))
      const debit = parseAmount(pickCol(row, ['Debit', 'Withdrawal', 'Debit Amount', 'DR']))
      const amount = credit || parseAmount(pickCol(row, ['Amount']))
      const ref = clean(pickCol(row, ['Reference', 'Cheque No', 'Cheque Number', 'Ref No', 'Instrument No']))

      if (!date || (amount <= 0 && credit <= 0)) return
      // Only consider credits (money in) for rent reconciliation
      const finalAmount = credit || (debit <= 0 ? amount : 0)
      if (finalAmount <= 0) return

      bankRows.push({
        rowNum: i + 2,
        date,
        amount: finalAmount,
        description: desc,
        ref,
      })
    })

    // Fetch all unclear cheques for this org
    const cheques = await prisma.cheque.findMany({
      where: { organizationId, status: { in: ['Received', 'Pending', 'Deposited'] } },
      include: { tenant: { select: { name: true } }, unit: { select: { unitNo: true } } },
    })

    const matched: Match[] = []
    const usedBankRows = new Set<number>()
    const usedCheques = new Set<string>()

    // Match: cheque number found in description/ref + amount within AED 1 + date within 14 days
    for (const c of cheques) {
      if (!c.chequeNo) continue
      for (const b of bankRows) {
        if (usedBankRows.has(b.rowNum) || usedCheques.has(c.id)) continue
        const refMatch = b.description.includes(c.chequeNo) || b.ref.includes(c.chequeNo)
        const amountMatch = Math.abs(b.amount - c.amount) < 1
        const dDiff = daysDiff(b.date, c.chequeDate)
        const dateMatch = dDiff <= 14

        if (refMatch && amountMatch && dateMatch) {
          const score = 100 - dDiff
          matched.push({
            bankRow: b,
            chequeId: c.id,
            chequeNo: c.chequeNo,
            chequeDate: c.chequeDate,
            amount: c.amount,
            tenantName: c.tenant?.name || '—',
            unitNo: c.unit?.unitNo || '—',
            daysDiff: dDiff,
            score,
          })
          usedBankRows.add(b.rowNum)
          usedCheques.add(c.id)
          break
        }
      }
    }

    // Second pass: match by amount + date only (no ref)
    for (const c of cheques) {
      if (usedCheques.has(c.id)) continue
      for (const b of bankRows) {
        if (usedBankRows.has(b.rowNum)) continue
        const amountMatch = Math.abs(b.amount - c.amount) < 1
        const dDiff = daysDiff(b.date, c.chequeDate)
        const dateMatch = dDiff <= 7 // stricter if no ref

        if (amountMatch && dateMatch) {
          matched.push({
            bankRow: b,
            chequeId: c.id,
            chequeNo: c.chequeNo || '(no-ref)',
            chequeDate: c.chequeDate,
            amount: c.amount,
            tenantName: c.tenant?.name || '—',
            unitNo: c.unit?.unitNo || '—',
            daysDiff: dDiff,
            score: 60 - dDiff,
          })
          usedBankRows.add(b.rowNum)
          usedCheques.add(c.id)
          break
        }
      }
    }

    const unmatchedBank = bankRows.filter((b) => !usedBankRows.has(b.rowNum))
    const unmatchedCheques = cheques.filter((c) => !usedCheques.has(c.id)).map((c) => ({
      id: c.id,
      chequeNo: c.chequeNo,
      chequeDate: c.chequeDate,
      amount: c.amount,
      tenantName: c.tenant?.name || '—',
      unitNo: c.unit?.unitNo || '—',
      status: c.status,
    }))

    // If commit, mark matched cheques as Cleared
    let clearedCount = 0
    if (commit) {
      for (const m of matched) {
        await prisma.cheque.update({
          where: { id: m.chequeId },
          data: {
            status: 'Cleared',
            clearedDate: m.bankRow.date,
            notes: `Reconciled with bank statement row ${m.bankRow.rowNum}`,
          },
        })
        clearedCount++
      }
      await logActivity(
        organizationId,
        session.user.name,
        'Bank Reconciliation',
        `Uploaded statement: ${matched.length} matched, ${unmatchedBank.length} unmatched bank rows, ${unmatchedCheques.length} unmatched cheques. Cleared ${clearedCount} cheques.`
      )
    }

    const matchedTotal = matched.reduce((s, m) => s + m.amount, 0)
    const bankTotal = bankRows.reduce((s, b) => s + b.amount, 0)

    return NextResponse.json({
      bankRowCount: bankRows.length,
      bankTotal,
      matched,
      matchedTotal,
      unmatchedBank,
      unmatchedCheques,
      committed: commit,
      clearedCount,
    })
  } catch (error) {
    console.error('POST /api/admin/reconcile-bank error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
