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

    const {
      staffRecommendedRent,
      newStartDate,
      newEndDate,
      staffNotes,
    } = body

    const existing = await prisma.renewalRequest.findFirst({
      where: { id: id, organizationId },
      include: {
        unit: { select: { unitNo: true } },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Renewal request not found' }, { status: 404 })
    }

    if (existing.status !== 'Requested' && existing.status !== 'Under Review') {
      return NextResponse.json(
        { error: `Cannot review a renewal in "${existing.status}" status` },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {
      status: 'CEO Pending',
      reviewedAt: new Date(),
    }

    if (staffRecommendedRent !== undefined) {
      updateData.staffRecommendedRent = parseFloat(staffRecommendedRent)
    }
    if (newStartDate !== undefined) updateData.newStartDate = newStartDate
    if (newEndDate !== undefined) updateData.newEndDate = newEndDate
    if (staffNotes !== undefined) updateData.staffNotes = staffNotes

    const renewal = await prisma.renewalRequest.update({
      where: { id },
      data: updateData,
      include: {
        tenant: { select: { id: true, name: true } },
        unit: { select: { id: true, unitNo: true } },
      },
    })

    // Notify CEO/admin for decision
    await createNotification(
      organizationId,
      'staff',
      '',
      `Renewal Pending CEO Decision: Unit ${existing.unit?.unitNo}`,
      `Staff reviewed renewal for Unit ${existing.unit?.unitNo}. Recommended rent: AED ${renewal.staffRecommendedRent.toFixed(2)}. Awaiting CEO decision.`,
      'renewal'
    )

    await logActivity(
      organizationId,
      session.user.name,
      'Reviewed Renewal Request',
      `Renewal for Unit ${existing.unit?.unitNo} reviewed - recommended rent: AED ${renewal.staffRecommendedRent.toFixed(2)}, sent to CEO`
    )

    return NextResponse.json(renewal)
  } catch (error) {
    console.error('PUT /api/renewals/[id]/review error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
