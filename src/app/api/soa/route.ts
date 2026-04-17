import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

const UPFRONT_PREFIX = 'UPFRONT_JSON:'
function parseUpfront(notes: string | undefined | null) {
  const def = { cash: 0, chequeAmount: 0, chequeNo: '', bankName: '', chequeDate: '', receiptNo: '', receiptSentAt: '' }
  if (!notes) return def
  for (const line of notes.split('\n')) {
    if (line.startsWith(UPFRONT_PREFIX)) {
      try { return { ...def, ...JSON.parse(line.slice(UPFRONT_PREFIX.length)) } } catch { /* ignore */ }
    }
  }
  return def
}

/**
 * GET /api/soa — Statement of Account per tenant.
 * Returns one entry per tenant who has a contract, with totals + timeline.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const organizationId = session.user.organizationId

    const tenants = await prisma.tenant.findMany({
      where: { organizationId },
      include: {
        units: { select: { id: true, unitNo: true } },
      },
      orderBy: { name: 'asc' },
    })

    const tenantIds = tenants.map((t) => t.id)
    const contracts = await prisma.tenancyContract.findMany({
      where: { organizationId, tenantId: { in: tenantIds } },
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
    })
    const cheques = await prisma.cheque.findMany({
      where: { organizationId, tenantId: { in: tenantIds } },
      orderBy: { sequenceNo: 'asc' },
    })
    const invoices = await prisma.invoice.findMany({
      where: { organizationId, tenantId: { in: tenantIds } },
      include: { payments: { orderBy: { paymentDate: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    })

    type Activity = { date: string; kind: string; label: string; amount: number; status: string; ref: string }

    const soa = tenants.map((tenant) => {
      const myContracts = contracts.filter((c) => c.tenantId === tenant.id)
      const latest = myContracts[0] || null
      const myCheques = cheques.filter((c) => c.tenantId === tenant.id)
      const myInvoices = invoices.filter((i) => i.tenantId === tenant.id)
      const upfront = latest ? parseUpfront(latest.notes) : { cash: 0, chequeAmount: 0, chequeNo: '', bankName: '', chequeDate: '', receiptNo: '', receiptSentAt: '' }
      const upfrontTotal = (upfront.cash || 0) + (upfront.chequeAmount || 0)

      const annualRent = latest?.rentAmount || 0
      const invoiceTotal = myInvoices.reduce((s, i) => s + (i.totalAmount || 0), 0)
      const totalBilled = annualRent + invoiceTotal

      // Cleared cheques exclude the upfront cheque (already counted).
      const clearedCheques = myCheques
        .filter((c) => c.status === 'Cleared' && !(c.sequenceNo === 1 && c.paymentType === 'Upfront'))
        .reduce((s, c) => s + (c.amount || 0), 0)
      const invoicePaid = myInvoices.reduce((s, i) => s + (i.paidAmount || 0), 0)

      const totalPaid = upfrontTotal + clearedCheques + invoicePaid
      const pending = Math.max(0, totalBilled - totalPaid)

      const pdcsInHand = myCheques
        .filter((c) => !!c.chequeNo && c.status !== 'Cleared' && c.status !== 'Bounced' && !(c.sequenceNo === 1 && c.paymentType === 'Upfront'))
        .reduce((s, c) => s + (c.amount || 0), 0)
      const bouncedTotal = myCheques.filter((c) => c.status === 'Bounced').reduce((s, c) => s + (c.amount || 0), 0)

      const activity: Activity[] = []
      if (upfront.receiptSentAt && upfrontTotal > 0) {
        activity.push({
          date: upfront.receiptSentAt,
          kind: 'Upfront',
          label: `Upfront received (${upfront.cash > 0 ? 'cash' : ''}${upfront.cash > 0 && upfront.chequeAmount > 0 ? ' + ' : ''}${upfront.chequeAmount > 0 ? `cheque ${upfront.chequeNo || ''}` : ''})`,
          amount: upfrontTotal,
          status: 'Received',
          ref: upfront.receiptNo || '',
        })
      }
      for (const c of myCheques) {
        if (c.sequenceNo === 1 && c.paymentType === 'Upfront') continue // already in upfront
        activity.push({
          date: c.clearedDate || c.chequeDate || c.createdAt.toISOString(),
          kind: 'Cheque',
          label: `Cheque ${c.sequenceNo} ${c.chequeNo ? `#${c.chequeNo}` : ''} ${c.bankName ? `(${c.bankName})` : ''}`.trim(),
          amount: c.amount || 0,
          status: c.status,
          ref: c.chequeNo || '',
        })
      }
      for (const i of myInvoices) {
        activity.push({
          date: i.createdAt.toISOString(),
          kind: 'Invoice',
          label: `Invoice ${i.invoiceNo} (${i.type})`,
          amount: i.totalAmount,
          status: i.status,
          ref: i.invoiceNo,
        })
        for (const p of i.payments) {
          activity.push({
            date: p.paymentDate || p.createdAt.toISOString(),
            kind: 'Payment',
            label: `Payment via ${p.method} ${p.referenceNo ? `(ref ${p.referenceNo})` : ''}`,
            amount: p.amount,
            status: 'Received',
            ref: p.referenceNo || '',
          })
        }
      }
      activity.sort((a, b) => (b.date || '').localeCompare(a.date || ''))

      return {
        tenant: { id: tenant.id, name: tenant.name, email: tenant.email, status: tenant.status },
        unit: tenant.units?.[0] || null,
        contract: latest
          ? { id: latest.id, contractNo: latest.contractNo, status: latest.status, contractStart: latest.contractStart, contractEnd: latest.contractEnd, rentAmount: latest.rentAmount }
          : null,
        totals: {
          annualRent,
          invoiceTotal,
          totalBilled,
          upfront: upfrontTotal,
          clearedCheques,
          invoicePaid,
          totalPaid,
          pending,
          pdcsInHand,
          bouncedTotal,
        },
        activity: activity.slice(0, 30),
      }
    })

    return NextResponse.json({ soa })
  } catch (error) {
    console.error('GET /api/soa error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
