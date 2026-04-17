import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId

    const payment = await prisma.payment.findFirst({
      where: { id: id, organizationId },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNo: true,
            totalAmount: true,
            paidAmount: true,
            status: true,
          },
        },
      },
    })

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    // Delete the payment
    await prisma.payment.delete({
      where: { id },
    })

    // Recalculate invoice paid amount from remaining payments
    const remainingPayments = await prisma.payment.aggregate({
      where: {
        invoiceId: payment.invoiceId,
        organizationId,
      },
      _sum: { amount: true },
    })

    const newPaidAmount = remainingPayments._sum.amount || 0

    let newStatus: string
    if (newPaidAmount >= payment.invoice.totalAmount) {
      newStatus = 'Paid'
    } else if (newPaidAmount > 0) {
      newStatus = 'Partially Paid'
    } else {
      // Determine if it should be Overdue or Sent
      const invoice = await prisma.invoice.findUnique({
        where: { id: payment.invoiceId },
        select: { dueDate: true },
      })
      const today = new Date().toISOString().split('T')[0]
      newStatus = invoice && invoice.dueDate < today ? 'Overdue' : 'Sent'
    }

    await prisma.invoice.update({
      where: { id: payment.invoiceId },
      data: {
        paidAmount: newPaidAmount,
        status: newStatus,
      },
    })

    await logActivity(
      organizationId,
      session.user.name,
      'Reversed Payment',
      `Payment of AED ${payment.amount.toFixed(2)} reversed for invoice ${payment.invoice.invoiceNo}`
    )

    return NextResponse.json({ message: 'Payment reversed successfully' })
  } catch (error) {
    console.error('DELETE /api/payments/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
