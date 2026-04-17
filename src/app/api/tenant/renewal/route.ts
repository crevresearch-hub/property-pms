import { NextRequest, NextResponse } from 'next/server'
import { getTenantSession } from '@/lib/tenant-auth'
import prisma from '@/lib/prisma'
import { createNotification } from '@/lib/notifications'

export async function GET(request: NextRequest) {
  const session = getTenantSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const renewals = await prisma.renewalRequest.findMany({
      where: { tenantId: session.id, organizationId: session.orgId },
      include: {
        unit: { select: { unitNo: true, contractStart: true, contractEnd: true, currentRent: true } },
      },
      orderBy: { requestedAt: 'desc' },
    })

    return NextResponse.json(renewals)
  } catch (error) {
    console.error('GET /api/tenant/renewal error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = getTenantSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { unitId, proposedRent, notes } = await request.json()

    // Verify unit belongs to tenant
    const unit = await prisma.unit.findFirst({
      where: { id: unitId, tenantId: session.id, organizationId: session.orgId },
    })

    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
    }

    // Check no pending renewal exists for this unit
    const existing = await prisma.renewalRequest.findFirst({
      where: {
        unitId,
        tenantId: session.id,
        organizationId: session.orgId,
        status: { in: ['Requested', 'Under Review'] },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'A renewal request is already pending for this unit' },
        { status: 400 }
      )
    }

    const renewal = await prisma.renewalRequest.create({
      data: {
        organizationId: session.orgId,
        unitId,
        tenantId: session.id,
        currentRent: unit.currentRent,
        proposedRent: proposedRent || unit.currentRent,
        status: 'Requested',
        tenantNotes: notes || '',
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
      `Lease Renewal Requested: Unit ${unit.unitNo}`,
      `${session.name} has requested a lease renewal.`,
      'renewal'
    )

    return NextResponse.json(renewal, { status: 201 })
  } catch (error) {
    console.error('POST /api/tenant/renewal error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
