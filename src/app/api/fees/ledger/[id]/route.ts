import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    const { id } = await params
    const body = await request.json()

    const existing = await prisma.feeLedger.findFirst({
      where: { id, organizationId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Fee entry not found' }, { status: 404 })
    }

    const paidDate = body.paidDate || new Date().toISOString().split('T')[0]

    const entry = await prisma.feeLedger.update({
      where: { id },
      data: {
        status: 'Paid',
        paidDate,
      },
      include: {
        tenant: { select: { id: true, name: true } },
        unit: { select: { id: true, unitNo: true } },
      },
    })

    await logActivity(
      organizationId,
      session.user.name,
      'Marked Fee as Paid',
      `${entry.feeType} - AED ${entry.amount.toFixed(2)} paid on ${paidDate}`
    )

    return NextResponse.json(entry)
  } catch (error) {
    console.error('PUT /api/fees/ledger/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
