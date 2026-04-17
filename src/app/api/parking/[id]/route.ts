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

    const existing = await prisma.parkingSlot.findFirst({
      where: { id, organizationId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Parking slot not found' }, { status: 404 })
    }

    // Action: assign or release
    const { action } = body

    if (action === 'assign') {
      const { tenantId, unitId, vehiclePlate, vehicleType, vehicleColor } = body

      if (!tenantId) {
        return NextResponse.json({ error: 'Tenant ID is required for assignment' }, { status: 400 })
      }

      // Verify tenant belongs to org
      const tenant = await prisma.tenant.findFirst({
        where: { id: tenantId, organizationId },
      })
      if (!tenant) {
        return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
      }

      if (unitId) {
        const unit = await prisma.unit.findFirst({
          where: { id: unitId, organizationId },
        })
        if (!unit) {
          return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
        }
      }

      const slot = await prisma.parkingSlot.update({
        where: { id },
        data: {
          tenantId,
          unitId: unitId || null,
          vehiclePlate: vehiclePlate || '',
          vehicleType: vehicleType || '',
          vehicleColor: vehicleColor || '',
          status: 'Assigned',
          assignedAt: new Date(),
        },
        include: {
          tenant: { select: { id: true, name: true } },
          unit: { select: { id: true, unitNo: true } },
        },
      })

      await logActivity(
        organizationId,
        session.user.name,
        'Assigned Parking Slot',
        `Slot ${slot.slotNo} assigned to ${tenant.name}`
      )

      return NextResponse.json(slot)
    } else if (action === 'release') {
      const slot = await prisma.parkingSlot.update({
        where: { id },
        data: {
          tenantId: null,
          unitId: null,
          vehiclePlate: '',
          vehicleType: '',
          vehicleColor: '',
          status: 'Available',
          assignedAt: null,
        },
      })

      await logActivity(
        organizationId,
        session.user.name,
        'Released Parking Slot',
        `Slot ${slot.slotNo} released`
      )

      return NextResponse.json(slot)
    } else {
      // General update
      const updateData: Record<string, unknown> = {}
      if (body.zone !== undefined) updateData.zone = body.zone
      if (body.floor !== undefined) updateData.floor = body.floor
      if (body.type !== undefined) updateData.type = body.type
      if (body.status !== undefined) updateData.status = body.status
      if (body.notes !== undefined) updateData.notes = body.notes
      if (body.vehiclePlate !== undefined) updateData.vehiclePlate = body.vehiclePlate
      if (body.vehicleType !== undefined) updateData.vehicleType = body.vehicleType
      if (body.vehicleColor !== undefined) updateData.vehicleColor = body.vehicleColor

      const slot = await prisma.parkingSlot.update({
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
        'Updated Parking Slot',
        `Slot ${slot.slotNo} updated`
      )

      return NextResponse.json(slot)
    }
  } catch (error) {
    console.error('PUT /api/parking/[id] error:', error)
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

    const existing = await prisma.parkingSlot.findFirst({
      where: { id, organizationId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Parking slot not found' }, { status: 404 })
    }

    await prisma.parkingSlot.delete({ where: { id } })

    await logActivity(
      organizationId,
      session.user.name,
      'Deleted Parking Slot',
      `Slot ${existing.slotNo} deleted`
    )

    return NextResponse.json({ message: 'Parking slot deleted' })
  } catch (error) {
    console.error('DELETE /api/parking/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
