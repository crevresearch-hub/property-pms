import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { createNotification } from '@/lib/notifications'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    const body = await request.json()

    const { decision, finalRent, ceoNotes } = body

    if (!decision || !['Approved', 'Rejected'].includes(decision)) {
      return NextResponse.json(
        { error: 'Decision must be "Approved" or "Rejected"' },
        { status: 400 }
      )
    }

    const existing = await prisma.renewalRequest.findFirst({
      where: { id: id, organizationId },
      include: {
        unit: { select: { unitNo: true } },
        tenant: { select: { id: true, name: true } },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Renewal request not found' }, { status: 404 })
    }

    if (existing.status !== 'CEO Pending') {
      return NextResponse.json(
        { error: `Cannot decide on a renewal in "${existing.status}" status. Must be "CEO Pending".` },
        { status: 400 }
      )
    }

    const newStatus = decision === 'Approved' ? 'Approved' : 'Rejected'

    const updateData: Record<string, unknown> = {
      status: newStatus,
      decidedAt: new Date(),
      ceoNotes: ceoNotes || '',
    }

    if (decision === 'Approved') {
      if (!finalRent) {
        return NextResponse.json(
          { error: 'Final rent is required when approving' },
          { status: 400 }
        )
      }
      updateData.finalRent = parseFloat(finalRent)
    }

    const renewal = await prisma.renewalRequest.update({
      where: { id },
      data: updateData,
      include: {
        tenant: { select: { id: true, name: true } },
        unit: { select: { id: true, unitNo: true } },
      },
    })

    // Notify tenant about the decision
    if (existing.tenant) {
      await createNotification(
        organizationId,
        'tenant',
        existing.tenant.id,
        `Renewal ${decision}: Unit ${existing.unit?.unitNo}`,
        decision === 'Approved'
          ? `Your renewal request for Unit ${existing.unit?.unitNo} has been approved at AED ${parseFloat(finalRent).toFixed(2)}/year. Please respond to confirm.`
          : `Your renewal request for Unit ${existing.unit?.unitNo} has been rejected. ${ceoNotes || ''}`,
        'renewal'
      )
    }

    // Notify staff
    await createNotification(
      organizationId,
      'staff',
      '',
      `CEO ${decision} Renewal: Unit ${existing.unit?.unitNo}`,
      `Renewal for Unit ${existing.unit?.unitNo} has been ${decision.toLowerCase()} by CEO.${decision === 'Approved' ? ` Final rent: AED ${parseFloat(finalRent).toFixed(2)}` : ''}`,
      'renewal'
    )

    await logActivity(
      organizationId,
      session.user.name,
      `CEO ${decision} Renewal`,
      `Renewal for Unit ${existing.unit?.unitNo} ${decision.toLowerCase()}${decision === 'Approved' ? ` at AED ${parseFloat(finalRent).toFixed(2)}` : ''}`
    )

    return NextResponse.json(renewal)
  } catch (error) {
    console.error('PUT /api/renewals/[id]/decide error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
