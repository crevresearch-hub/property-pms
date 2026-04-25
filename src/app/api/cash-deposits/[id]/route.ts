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
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const organizationId = session.user.organizationId
    const { id } = await params
    const body = await request.json()

    const existing = await prisma.cashDeposit.findFirst({ where: { id, organizationId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (body.amount !== undefined) data.amount = parseFloat(body.amount)
    if (body.cashSource !== undefined) data.cashSource = body.cashSource
    if (body.tenantId !== undefined) data.tenantId = body.tenantId || null
    if (body.tenantName !== undefined) data.tenantName = body.tenantName
    if (body.unitNo !== undefined) data.unitNo = body.unitNo
    if (body.ownerId !== undefined) data.ownerId = body.ownerId || null
    if (body.ownerName !== undefined) data.ownerName = body.ownerName
    if (body.bankName !== undefined) data.bankName = body.bankName
    if (body.accountNo !== undefined) data.accountNo = body.accountNo
    if (body.referenceNo !== undefined) data.referenceNo = body.referenceNo
    if (body.depositedAt !== undefined) data.depositedAt = body.depositedAt
    if (body.status !== undefined) data.status = body.status
    if (body.notes !== undefined) data.notes = body.notes

    const updated = await prisma.cashDeposit.update({ where: { id }, data })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('PUT /api/cash-deposits/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const organizationId = session.user.organizationId
    const { id } = await params

    const existing = await prisma.cashDeposit.findFirst({ where: { id, organizationId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.cashDeposit.delete({ where: { id } })
    await logActivity(
      organizationId,
      session.user.name,
      'Deleted Cash Deposit',
      `AED ${existing.amount.toLocaleString()} ref ${existing.referenceNo || '—'}`
    )
    return NextResponse.json({ message: 'Deleted' })
  } catch (error) {
    console.error('DELETE /api/cash-deposits/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
