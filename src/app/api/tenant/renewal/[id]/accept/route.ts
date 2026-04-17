import { NextRequest, NextResponse } from 'next/server'
import { getTenantSession } from '@/lib/tenant-auth'
import prisma from '@/lib/prisma'
import { createNotification } from '@/lib/notifications'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getTenantSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params

    // Find the approved renewal belonging to this tenant
    const renewal = await prisma.renewalRequest.findFirst({
      where: {
        id,
        tenantId: session.id,
        organizationId: session.orgId,
        status: 'Approved',
      },
      include: {
        unit: true,
      },
    })

    if (!renewal) {
      return NextResponse.json(
        { error: 'Approved renewal request not found' },
        { status: 404 }
      )
    }

    // Archive current contract
    await prisma.contractHistory.create({
      data: {
        organizationId: session.orgId,
        unitId: renewal.unitId,
        tenantId: session.id,
        contractStart: renewal.unit.contractStart,
        contractEnd: renewal.unit.contractEnd,
        rentAmount: renewal.unit.currentRent,
        renewalRequestId: renewal.id,
      },
    })

    // Update unit with new contract details
    await prisma.unit.update({
      where: { id: renewal.unitId },
      data: {
        contractStart: renewal.newStartDate,
        contractEnd: renewal.newEndDate,
        currentRent: renewal.finalRent,
      },
    })

    // Mark renewal as accepted
    const updated = await prisma.renewalRequest.update({
      where: { id },
      data: {
        status: 'Accepted',
        acceptedAt: new Date(),
      },
      include: {
        unit: { select: { unitNo: true } },
      },
    })

    // Notify staff
    await createNotification(
      session.orgId,
      'staff',
      '',
      `Renewal Accepted: Unit ${renewal.unit.unitNo}`,
      `${session.name} accepted the renewal. New rent: ${renewal.finalRent}`,
      'renewal'
    )

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PUT /api/tenant/renewal/[id]/accept error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
