import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    const body = await request.json()

    const { zone, floor, prefix, start, end, type } = body

    if (!start || !end) {
      return NextResponse.json(
        { error: 'Start and end range numbers are required' },
        { status: 400 }
      )
    }

    const startNum = parseInt(start, 10)
    const endNum = parseInt(end, 10)

    if (isNaN(startNum) || isNaN(endNum) || startNum > endNum) {
      return NextResponse.json(
        { error: 'Invalid range: start must be less than or equal to end' },
        { status: 400 }
      )
    }

    if (endNum - startNum + 1 > 500) {
      return NextResponse.json(
        { error: 'Cannot create more than 500 slots at once' },
        { status: 400 }
      )
    }

    const slotPrefix = prefix || `${zone || 'A'}-`
    const created: string[] = []
    const skipped: string[] = []

    for (let i = startNum; i <= endNum; i++) {
      const slotNo = `${slotPrefix}${String(i).padStart(3, '0')}`

      const existing = await prisma.parkingSlot.findUnique({
        where: { organizationId_slotNo: { organizationId, slotNo } },
      })

      if (existing) {
        skipped.push(slotNo)
        continue
      }

      await prisma.parkingSlot.create({
        data: {
          organizationId,
          slotNo,
          zone: zone || 'A',
          floor: floor || 'Basement',
          type: type || 'Standard',
          status: 'Available',
        },
      })

      created.push(slotNo)
    }

    await logActivity(
      organizationId,
      session.user.name,
      'Bulk Created Parking Slots',
      `Created ${created.length} slots (${skipped.length} skipped as duplicates)`
    )

    return NextResponse.json({
      message: `Created ${created.length} parking slots`,
      created: created.length,
      skipped: skipped.length,
      skippedSlots: skipped,
    }, { status: 201 })
  } catch (error) {
    console.error('POST /api/parking/bulk error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
