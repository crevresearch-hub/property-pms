import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId

    const payments = await prisma.payment.findMany({
      where: { organizationId },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNo: true,
            totalAmount: true,
            status: true,
            dueDate: true,
            tenantId: true,
            unitId: true,
            tenant: {
              select: {
                id: true,
                name: true,
              },
            },
            unit: {
              select: {
                id: true,
                unitNo: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(payments)
  } catch (error) {
    console.error('GET /api/payments error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    const body = await request.json()

    const { invoiceId, amount, paymentDate, method, chequeNo, chequeDate, chequeBank, chequeStatus, referenceNo, notes } = body

    if (!invoiceId || !amount || !paymentDate) {
      return NextResponse.json(
        { error: 'Invoice ID, amount, and payment date are required' },
        { status: 400 }
      )
    }

    // Verify invoice belongs to the organization
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    if (invoice.status === 'Cancelled') {
      return NextResponse.json(
        { error: 'Cannot record payment for a cancelled invoice' },
        { status: 400 }
      )
    }

    const parsedAmount = parseFloat(amount)

    if (parsedAmount <= 0) {
      return NextResponse.json({ error: 'Payment amount must be positive' }, { status: 400 })
    }

    // Create the payment
    const payment = await prisma.payment.create({
      data: {
        organizationId,
        invoiceId,
        amount: parsedAmount,
        paymentDate,
        method: method || 'Bank Transfer',
        chequeNo: chequeNo || '',
        chequeDate: chequeDate || '',
        chequeBank: chequeBank || '',
        chequeStatus: chequeStatus || '',
        referenceNo: referenceNo || '',
        notes: notes || '',
        recordedBy: session.user.name,
      },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNo: true,
            tenant: { select: { id: true, name: true } },
            unit: { select: { id: true, unitNo: true } },
          },
        },
      },
    })

    // Update invoice paid amount and status
    const newPaidAmount = invoice.paidAmount + parsedAmount

    let newStatus = invoice.status
    if (newPaidAmount >= invoice.totalAmount) {
      newStatus = 'Paid'
    } else if (newPaidAmount > 0) {
      newStatus = 'Partially Paid'
    }

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        paidAmount: newPaidAmount,
        status: newStatus,
      },
    })

    await logActivity(
      organizationId,
      session.user.name,
      'Recorded Payment',
      `Payment of AED ${parsedAmount.toFixed(2)} recorded for invoice ${invoice.invoiceNo}`
    )

    return NextResponse.json(payment, { status: 201 })
  } catch (error) {
    console.error('POST /api/payments error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
