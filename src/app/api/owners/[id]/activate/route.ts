import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { createNotification } from '@/lib/notifications'
// Email removed per user request - too many emails. Only: contract_sent, admin_owner_signed, final_package.

export async function POST(
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

    const existing = await prisma.propertyOwner.findFirst({
      where: { id, organizationId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Owner not found' }, { status: 404 })
    }

    const now = new Date()
    const updated = await prisma.propertyOwner.update({
      where: { id },
      data: {
        stage: 'Live',
        livePMSDate: now,
      },
    })

    await createNotification(
      organizationId,
      'staff',
      '',
      'Building Live in PMS',
      `${existing.buildingName} (Owner: ${existing.ownerName}) is now live in the PMS.`,
      'system'
    )

    await logActivity(
      organizationId,
      session.user.name,
      'Building Activated in PMS',
      `${existing.buildingName} – Owner ${existing.ownerName}`
    )

    // Email removed per user request - too many emails. Only: contract_sent, admin_owner_signed, final_package.

    return NextResponse.json({ message: 'Building activated in PMS', owner: updated })
  } catch (error) {
    console.error('POST /api/owners/[id]/activate error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
