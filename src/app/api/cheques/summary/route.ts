import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId

    const cheques = await prisma.cheque.findMany({
      where: { organizationId },
      include: {
        tenant: {
          select: { id: true, name: true },
        },
      },
    })

    type ChequeWithTenant = typeof cheques[number]
    const sumAmount = (arr: ChequeWithTenant[]) => arr.reduce((s: number, c: ChequeWithTenant) => s + c.amount, 0)

    // Per spec parent-id model: Replaced rows are immutable audit anchors —
    // their child carries the live amount. Excluding parent rows from the
    // overall total avoids double-counting the same installment when a
    // Replacement / Bounce-Collect spawns a new linked row.
    const activeCheques = cheques.filter((c: ChequeWithTenant) => c.status !== 'Replaced')
    const total = activeCheques.length
    const totalAmount = sumAmount(activeCheques)

    const received = cheques.filter((c: ChequeWithTenant) => c.status === 'Received')
    const cleared = cheques.filter((c: ChequeWithTenant) => c.status === 'Cleared')
    const bounced = cheques.filter((c: ChequeWithTenant) => c.status === 'Bounced')
    const deposited = cheques.filter((c: ChequeWithTenant) => c.status === 'Deposited')
    const replaced = cheques.filter((c: ChequeWithTenant) => c.status === 'Replaced')

    const summary = {
      total,
      totalAmount,
      received: {
        count: received.length,
        amount: sumAmount(received),
      },
      cleared: {
        count: cleared.length,
        amount: sumAmount(cleared),
      },
      bounced: {
        count: bounced.length,
        amount: sumAmount(bounced),
      },
      deposited: {
        count: deposited.length,
        amount: sumAmount(deposited),
      },
      replaced: {
        count: replaced.length,
        amount: sumAmount(replaced),
      },
    }

    // Per-tenant breakdown
    const tenantMap = new Map<string, {
      tenantId: string
      tenantName: string
      total: number
      totalAmount: number
      received: number
      cleared: number
      bounced: number
      deposited: number
    }>()

    for (const cheque of cheques) {
      const tid = cheque.tenantId
      const tname = cheque.tenant?.name || 'Unknown'

      if (!tenantMap.has(tid)) {
        tenantMap.set(tid, {
          tenantId: tid,
          tenantName: tname,
          total: 0,
          totalAmount: 0,
          received: 0,
          cleared: 0,
          bounced: 0,
          deposited: 0,
        })
      }

      const entry = tenantMap.get(tid)!
      // Skip Replaced parents in tenant totals — same double-count avoidance
      // as the global summary above.
      if (cheque.status !== 'Replaced') {
        entry.total += 1
        entry.totalAmount += cheque.amount
      }

      if (cheque.status === 'Received') entry.received += 1
      if (cheque.status === 'Cleared') entry.cleared += 1
      if (cheque.status === 'Bounced') entry.bounced += 1
      if (cheque.status === 'Deposited') entry.deposited += 1
    }

    const tenantBreakdown = Array.from(tenantMap.values())

    return NextResponse.json({ summary, tenantBreakdown })
  } catch (error) {
    console.error('GET /api/cheques/summary error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
