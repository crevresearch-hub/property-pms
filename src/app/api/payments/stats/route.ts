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

    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const nextMonth = now.getMonth() === 11
      ? `${now.getFullYear() + 1}-01-01`
      : `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}-01`
    const today = now.toISOString().split('T')[0]

    // Collected this month: sum of payments with paymentDate in current month
    const collectedThisMonth = await prisma.payment.aggregate({
      where: {
        organizationId,
        paymentDate: {
          gte: monthStart,
          lt: nextMonth,
        },
      },
      _sum: { amount: true },
    })

    // Outstanding: sum of (totalAmount - paidAmount) for non-Paid, non-Cancelled, non-Draft invoices
    const outstandingInvoices = await prisma.invoice.findMany({
      where: {
        organizationId,
        status: { in: ['Sent', 'Overdue', 'Partially Paid'] },
      },
      select: {
        totalAmount: true,
        paidAmount: true,
      },
    })

    const outstanding = outstandingInvoices.reduce(
      (sum: number, inv: { totalAmount: number; paidAmount: number }) => sum + (inv.totalAmount - inv.paidAmount),
      0
    )

    // Overdue count: invoices that are Overdue or Sent but past due date
    const overdueCount = await prisma.invoice.count({
      where: {
        organizationId,
        OR: [
          { status: 'Overdue' },
          {
            status: 'Sent',
            dueDate: { lt: today },
          },
        ],
      },
    })

    // Cheques pending: count of cheques with status "Received" (not yet cleared/bounced)
    const chequesPending = await prisma.cheque.count({
      where: {
        organizationId,
        status: 'Received',
      },
    })

    return NextResponse.json({
      collected_this_month: collectedThisMonth._sum.amount || 0,
      outstanding,
      overdue_count: overdueCount,
      cheques_pending: chequesPending,
    })
  } catch (error) {
    console.error('GET /api/payments/stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
