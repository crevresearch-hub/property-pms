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

    const { response } = body

    if (!response || !['Accept', 'Decline'].includes(response)) {
      return NextResponse.json(
        { error: 'Response must be "Accept" or "Decline"' },
        { status: 400 }
      )
    }

    const existing = await prisma.renewalRequest.findFirst({
      where: { id: id, organizationId },
      include: {
        unit: {
          select: {
            id: true,
            unitNo: true,
            currentRent: true,
            contractStart: true,
            contractEnd: true,
            tenantId: true,
          },
        },
        tenant: { select: { id: true, name: true } },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Renewal request not found' }, { status: 404 })
    }

    if (existing.status !== 'Approved') {
      return NextResponse.json(
        { error: `Cannot respond to a renewal in "${existing.status}" status. Must be "Approved".` },
        { status: 400 }
      )
    }

    if (response === 'Decline') {
      const renewal = await prisma.renewalRequest.update({
        where: { id },
        data: {
          status: 'Tenant Declined',
          acceptedAt: new Date(),
        },
        include: {
          tenant: { select: { id: true, name: true } },
          unit: { select: { id: true, unitNo: true } },
        },
      })

      await createNotification(
        organizationId,
        'staff',
        '',
        `Tenant Declined Renewal: Unit ${existing.unit?.unitNo}`,
        `${existing.tenant?.name || 'Tenant'} has declined the renewal for Unit ${existing.unit?.unitNo}.`,
        'renewal'
      )

      await logActivity(
        organizationId,
        session.user.name,
        'Tenant Declined Renewal',
        `Tenant ${existing.tenant?.name} declined renewal for Unit ${existing.unit?.unitNo}`
      )

      return NextResponse.json(renewal)
    }

    // Accept: archive old contract, update unit, update renewal status
    // Use a transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx: typeof prisma) => {
      // 1. Archive the current contract to contract_history
      if (existing.unit) {
        await tx.contractHistory.create({
          data: {
            organizationId,
            unitId: existing.unit.id,
            tenantId: existing.tenantId || existing.unit.tenantId || null,
            contractStart: existing.unit.contractStart,
            contractEnd: existing.unit.contractEnd,
            rentAmount: existing.unit.currentRent,
            renewalRequestId: id,
          },
        })
      }

      // 2. Update the unit with new contract dates and rent
      if (existing.unit) {
        await tx.unit.update({
          where: { id: existing.unit.id },
          data: {
            contractStart: existing.newStartDate || existing.unit.contractEnd,
            contractEnd: existing.newEndDate,
            currentRent: existing.finalRent,
            status: 'Occupied',
          },
        })
      }

      // 3. Update the renewal request status
      const renewal = await tx.renewalRequest.update({
        where: { id },
        data: {
          status: 'Accepted',
          acceptedAt: new Date(),
        },
        include: {
          tenant: { select: { id: true, name: true } },
          unit: { select: { id: true, unitNo: true, currentRent: true, contractStart: true, contractEnd: true } },
        },
      })

      return renewal
    })

    // Notify staff about acceptance
    await createNotification(
      organizationId,
      'staff',
      '',
      `Tenant Accepted Renewal: Unit ${existing.unit?.unitNo}`,
      `${existing.tenant?.name || 'Tenant'} has accepted the renewal for Unit ${existing.unit?.unitNo} at AED ${existing.finalRent.toFixed(2)}/year. Contract updated.`,
      'renewal'
    )

    await logActivity(
      organizationId,
      session.user.name,
      'Tenant Accepted Renewal',
      `Tenant ${existing.tenant?.name} accepted renewal for Unit ${existing.unit?.unitNo} at AED ${existing.finalRent.toFixed(2)}. Old contract archived, unit updated.`
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('PUT /api/renewals/[id]/tenant-respond error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
