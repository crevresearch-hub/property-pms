import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// GET /api/cash-ledger — chronological cash ledger for the org.
//
// Cash IN  : tenant-cash payments cleared via the cheque tracker
//            (Cheque rows where bankName="Cash" and status="Cleared").
// Cash OUT : two streams —
//            (a) CashDeposit rows — staff banking cash into owner's account
//            (b) VendorBill rows with paymentMethod="Cash" and status="Paid"
//                — vendor expenses paid in cash.
//
// Returns a flat list sorted by date ASC with a running balance + summary
// totals so the front-end can render a KPI strip + table directly.
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const organizationId = session.user.organizationId

    const [cashCheques, cashDeposits, vendorBills] = await Promise.all([
      prisma.cheque.findMany({
        where: {
          organizationId,
          bankName: 'Cash',
          status: 'Cleared',
        },
        select: {
          id: true,
          amount: true,
          chequeDate: true,
          clearedDate: true,
          paymentType: true,
          tenantId: true,
          unitId: true,
          tenant: { select: { id: true, name: true } },
          unit: { select: { id: true, unitNo: true } },
          createdAt: true,
        },
      }),
      prisma.cashDeposit.findMany({
        where: { organizationId },
        select: {
          id: true,
          amount: true,
          depositedAt: true,
          cashSource: true,
          tenantName: true,
          unitNo: true,
          ownerName: true,
          bankName: true,
          referenceNo: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.vendorBill.findMany({
        where: {
          organizationId,
          paymentMethod: 'Cash',
          status: 'Paid',
        },
        select: {
          id: true,
          totalAmount: true,
          paymentDate: true,
          billDate: true,
          billNo: true,
          serviceType: true,
          vendor: { select: { id: true, companyName: true } },
          unit: { select: { id: true, unitNo: true } },
          tenant: { select: { id: true, name: true } },
          createdAt: true,
        },
      }),
    ])

    type LedgerRow = {
      id: string
      date: string
      kind: 'in' | 'out'
      type: string                // human-readable category
      description: string
      unitNo: string
      tenantName: string
      counterparty: string        // owner / vendor / tenant
      amountIn: number
      amountOut: number
      runningBalance: number
      ref: string                 // cross-link id
    }

    const rows: Omit<LedgerRow, 'runningBalance'>[] = []

    for (const c of cashCheques) {
      const date = c.clearedDate || c.chequeDate || c.createdAt.toISOString().slice(0, 10)
      rows.push({
        id: `chq-${c.id}`,
        date,
        kind: 'in',
        type: 'Cash Received',
        description: `${c.paymentType || 'Rent'} — cash from tenant`,
        unitNo: c.unit?.unitNo || '',
        tenantName: c.tenant?.name || '',
        counterparty: c.tenant?.name || '',
        amountIn: c.amount || 0,
        amountOut: 0,
        ref: c.id,
      })
    }
    for (const d of cashDeposits) {
      const date = d.depositedAt || d.createdAt.toISOString().slice(0, 10)
      rows.push({
        id: `dep-${d.id}`,
        date,
        kind: 'out',
        type: 'Banked to Owner',
        description: `${d.cashSource || 'Cash'} → ${d.bankName || 'owner bank'}${d.referenceNo ? ` (ref ${d.referenceNo})` : ''}`,
        unitNo: d.unitNo || '',
        tenantName: d.tenantName || '',
        counterparty: d.ownerName || 'Owner',
        amountIn: 0,
        amountOut: d.amount || 0,
        ref: d.id,
      })
    }
    for (const b of vendorBills) {
      const date = b.paymentDate || b.billDate || b.createdAt.toISOString().slice(0, 10)
      rows.push({
        id: `vb-${b.id}`,
        date,
        kind: 'out',
        type: 'Vendor Bill (Cash)',
        description: `${b.serviceType || 'Service'}${b.billNo ? ` · ${b.billNo}` : ''}`,
        unitNo: b.unit?.unitNo || '',
        tenantName: b.tenant?.name || '',
        counterparty: b.vendor?.companyName || 'Vendor',
        amountIn: 0,
        amountOut: b.totalAmount || 0,
        ref: b.id,
      })
    }

    // Sort ASC by date, then by kind (cash in before cash out on the same day so
    // the running balance never temporarily goes negative just because of order).
    rows.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      if (a.kind !== b.kind) return a.kind === 'in' ? -1 : 1
      return 0
    })

    let balance = 0
    const ledger: LedgerRow[] = rows.map((r) => {
      balance += r.amountIn - r.amountOut
      return { ...r, runningBalance: balance }
    })

    const totals = {
      received: ledger.reduce((s, r) => s + r.amountIn, 0),
      bankedToOwner: ledger.filter((r) => r.type === 'Banked to Owner').reduce((s, r) => s + r.amountOut, 0),
      vendorExpenses: ledger.filter((r) => r.type === 'Vendor Bill (Cash)').reduce((s, r) => s + r.amountOut, 0),
      totalOut: ledger.reduce((s, r) => s + r.amountOut, 0),
      onHand: balance,
      transactions: ledger.length,
    }

    return NextResponse.json({ ledger, totals })
  } catch (error) {
    console.error('GET /api/cash-ledger error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
