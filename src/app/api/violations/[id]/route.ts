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

    const existing = await prisma.violation.findFirst({
      where: { id, organizationId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Violation not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    if (body.status !== undefined) updateData.status = body.status
    if (body.fineAmount !== undefined) updateData.fineAmount = parseFloat(body.fineAmount)
    if (body.severity !== undefined) updateData.severity = body.severity
    if (body.notes !== undefined) updateData.notes = body.notes

    if (body.status === 'Acknowledged' && !existing.acknowledgedAt) {
      updateData.acknowledgedAt = new Date()
    }
    if (body.status === 'Paid' && !existing.paidAt) {
      updateData.paidAt = new Date()
    }

    const violation = await prisma.violation.update({
      where: { id },
      data: updateData,
      include: {
        tenant: { select: { id: true, name: true } },
        unit: { select: { id: true, unitNo: true } },
      },
    })

    await logActivity(
      organizationId,
      session.user.name,
      'Updated Violation',
      `${violation.violationNo} - Status: ${violation.status}`
    )

    return NextResponse.json(violation)
  } catch (error) {
    console.error('PUT /api/violations/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    const { id } = await params

    const existing = await prisma.violation.findFirst({
      where: { id, organizationId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Violation not found' }, { status: 404 })
    }

    await prisma.violation.delete({ where: { id } })

    await logActivity(
      organizationId,
      session.user.name,
      'Deleted Violation',
      `${existing.violationNo} deleted`
    )

    return NextResponse.json({ message: 'Violation deleted' })
  } catch (error) {
    console.error('DELETE /api/violations/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
