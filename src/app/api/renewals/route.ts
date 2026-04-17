import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { createNotification } from '@/lib/notifications'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId

    const renewals = await prisma.renewalRequest.findMany({
      where: { organizationId },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        unit: {
          select: {
            id: true,
            unitNo: true,
            unitType: true,
            currentRent: true,
            contractStart: true,
            contractEnd: true,
          },
        },
      },
      orderBy: { requestedAt: 'desc' },
    })

    return NextResponse.json(renewals)
  } catch (error) {
    console.error('GET /api/renewals error:', error)
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

    const {
      unitId,
      tenantId,
      proposedRent,
      newStartDate,
      newEndDate,
      tenantNotes,
    } = body

    if (!unitId) {
      return NextResponse.json(
        { error: 'Unit ID is required' },
        { status: 400 }
      )
    }

    // Verify unit belongs to organization
    const unit = await prisma.unit.findFirst({
      where: { id: unitId, organizationId },
    })
    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
    }

    // Verify tenant belongs to organization if provided
    if (tenantId) {
      const tenant = await prisma.tenant.findFirst({
        where: { id: tenantId, organizationId },
      })
      if (!tenant) {
        return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
      }
    }

    // Check for existing pending renewal for this unit
    const existingRenewal = await prisma.renewalRequest.findFirst({
      where: {
        organizationId,
        unitId,
        status: { in: ['Requested', 'Under Review', 'CEO Pending'] },
      },
    })

    if (existingRenewal) {
      return NextResponse.json(
        { error: 'An active renewal request already exists for this unit' },
        { status: 400 }
      )
    }

    const renewal = await prisma.renewalRequest.create({
      data: {
        organizationId,
        unitId,
        tenantId: tenantId || unit.tenantId || null,
        currentRent: unit.currentRent,
        proposedRent: proposedRent ? parseFloat(proposedRent) : unit.currentRent,
        newStartDate: newStartDate || '',
        newEndDate: newEndDate || '',
        status: 'Requested',
        tenantNotes: tenantNotes || '',
      },
      include: {
        tenant: { select: { id: true, name: true } },
        unit: { select: { id: true, unitNo: true } },
      },
    })

    // Notify staff about new renewal request
    await createNotification(
      organizationId,
      'staff',
      '',
      `New Renewal Request for Unit ${unit.unitNo}`,
      `A renewal request has been submitted for Unit ${unit.unitNo}. Current rent: AED ${unit.currentRent.toFixed(2)}.`,
      'renewal'
    )

    await logActivity(
      organizationId,
      session.user.name,
      'Created Renewal Request',
      `Renewal request created for Unit ${unit.unitNo}`
    )

    return NextResponse.json(renewal, { status: 201 })
  } catch (error) {
    console.error('POST /api/renewals error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
