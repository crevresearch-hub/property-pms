import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId

    const slots = await prisma.parkingSlot.findMany({
      where: { organizationId },
      select: { status: true },
    })

    type SlotRow = { status: string }
    const total = slots.length
    const assigned = slots.filter((s: SlotRow) => s.status === 'Assigned').length
    const available = slots.filter((s: SlotRow) => s.status === 'Available').length
    const reserved = slots.filter((s: SlotRow) => s.status === 'Reserved').length

    // Count parking violations
    const parking_violations = await prisma.violation.count({
      where: { organizationId, type: 'Parking Violation' },
    })

    return NextResponse.json({
      total,
      assigned,
      available,
      reserved,
      parking_violations,
    })
  } catch (error) {
    console.error('GET /api/parking/stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
