import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const organizationId = session.user.organizationId
    const deposits = await prisma.cashDeposit.findMany({
      where: { organizationId },
      orderBy: [{ depositedAt: 'desc' }, { createdAt: 'desc' }],
    })
    return NextResponse.json(deposits)
  } catch (error) {
    console.error('GET /api/cash-deposits error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const organizationId = session.user.organizationId
    const body = await request.json()

    const amount = parseFloat(body.amount)
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Amount is required' }, { status: 400 })
    }
    if (!body.depositedAt) {
      return NextResponse.json({ error: 'Deposit date is required' }, { status: 400 })
    }

    const deposit = await prisma.cashDeposit.create({
      data: {
        organizationId,
        amount,
        cashSource: body.cashSource || '',
        tenantId: body.tenantId || null,
        tenantName: body.tenantName || '',
        unitNo: body.unitNo || '',
        ownerId: body.ownerId || null,
        ownerName: body.ownerName || '',
        bankName: body.bankName || '',
        accountNo: body.accountNo || '',
        referenceNo: body.referenceNo || '',
        depositedBy: body.depositedBy || session.user.name || '',
        depositedAt: body.depositedAt,
        status: body.status || 'Deposited',
        slipDocType: body.slipDocType || '',
        notes: body.notes || '',
      },
    })

    await logActivity(
      organizationId,
      session.user.name,
      'Recorded Cash Deposit',
      `AED ${amount.toLocaleString()} ${body.cashSource ? `(${body.cashSource})` : ''} → ${body.ownerName || 'owner'} · ref ${body.referenceNo || '—'}`
    )

    return NextResponse.json(deposit, { status: 201 })
  } catch (error) {
    console.error('POST /api/cash-deposits error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
