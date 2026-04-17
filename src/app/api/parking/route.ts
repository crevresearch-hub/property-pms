import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId

    const slots = await prisma.parkingSlot.findMany({
      where: { organizationId },
      include: {
        tenant: {
          select: { id: true, name: true, phone: true, email: true },
        },
        unit: {
          select: { id: true, unitNo: true },
        },
      },
      orderBy: { slotNo: 'asc' },
    })

    return NextResponse.json(slots)
  } catch (error) {
    console.error('GET /api/parking error:', error)
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

    const { slotNo, zone, floor, type, notes } = body

    if (!slotNo) {
      return NextResponse.json({ error: 'Slot number is required' }, { status: 400 })
    }

    // Check duplicate
    const existing = await prisma.parkingSlot.findUnique({
      where: { organizationId_slotNo: { organizationId, slotNo } },
    })
    if (existing) {
      return NextResponse.json({ error: 'Slot number already exists' }, { status: 409 })
    }

    const slot = await prisma.parkingSlot.create({
      data: {
        organizationId,
        slotNo,
        zone: zone || 'A',
        floor: floor || 'Basement',
        type: type || 'Standard',
        status: 'Available',
        notes: notes || '',
      },
    })

    await logActivity(
      organizationId,
      session.user.name,
      'Created Parking Slot',
      `Slot ${slotNo} created in Zone ${zone || 'A'}`
    )

    return NextResponse.json(slot, { status: 201 })
  } catch (error) {
    console.error('POST /api/parking error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
