import { NextRequest, NextResponse } from 'next/server'
import { getTenantSession } from '@/lib/tenant-auth'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = getTenantSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const count = await prisma.notification.count({
      where: {
        organizationId: session.orgId,
        isRead: false,
        OR: [
          { recipientType: 'tenant', recipientId: session.id },
          { recipientType: 'all' },
        ],
      },
    })

    return NextResponse.json({ count })
  } catch (error) {
    console.error('GET /api/tenant/notifications/unread-count error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
