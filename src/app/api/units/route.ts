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

    const units = await prisma.unit.findMany({
      where: { organizationId, deletedAt: null },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
      },
      orderBy: { unitNo: 'asc' },
    })

    // Attach pending pre-bookings per unit (by matching "Pre-Booked" note tag)
    const preBooked = await prisma.tenant.findMany({
      where: { organizationId, status: 'Pre-Booked' },
      select: { id: true, name: true, phone: true, expectedMoveIn: true, preBookingDeposit: true, notes: true },
    })

    const withPreBookings = units.map((u) => {
      const match = preBooked.find((pb) => (u.notes || '').includes(`Pre-Booked: ${pb.name}`) || (u.notes || '').includes(pb.name))
      return { ...u, preBooking: match ? { id: match.id, name: match.name, phone: match.phone, expectedMoveIn: match.expectedMoveIn, deposit: match.preBookingDeposit } : null }
    })

    return NextResponse.json(withPreBookings)
  } catch (error) {
    console.error('GET /api/units error:', error)
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

    const { unitNo, unitType, sqFt, contractStart, contractEnd, currentRent, status, notes, tenantId } = body

    if (!unitNo) {
      return NextResponse.json({ error: 'Unit number is required' }, { status: 400 })
    }

    // Check for duplicate unit number within the organization
    const existing = await prisma.unit.findUnique({
      where: { organizationId_unitNo: { organizationId, unitNo } },
    })

    if (existing) {
      return NextResponse.json({ error: 'Unit number already exists' }, { status: 409 })
    }

    const unit = await prisma.unit.create({
      data: {
        organizationId,
        unitNo,
        unitType: unitType || '',
        sqFt: sqFt ? parseFloat(sqFt) : 0,
        contractStart: contractStart || '',
        contractEnd: contractEnd || '',
        currentRent: currentRent ? parseFloat(currentRent) : 0,
        status: status || 'Vacant',
        notes: notes || '',
        tenantId: tenantId || null,
      },
      include: {
        tenant: {
          select: { id: true, name: true },
        },
      },
    })

    await logActivity(organizationId, session.user.name, 'Created Unit', `Unit ${unitNo} created`)

    return NextResponse.json(unit, { status: 201 })
  } catch (error) {
    console.error('POST /api/units error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
