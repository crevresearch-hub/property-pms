import { NextRequest, NextResponse } from 'next/server'
import { getTenantSession } from '@/lib/tenant-auth'
import prisma from '@/lib/prisma'

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

    // Verify notification belongs to tenant
    const notification = await prisma.notification.findFirst({
      where: {
        id,
        organizationId: session.orgId,
        OR: [
          { recipientType: 'tenant', recipientId: session.id },
          { recipientType: 'all' },
        ],
      },
    })

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PUT /api/tenant/notifications/[id]/read error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
