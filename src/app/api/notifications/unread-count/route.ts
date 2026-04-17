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

    const count = await prisma.notification.count({
      where: {
        organizationId,
        recipientType: { in: ['staff', 'all'] },
        isRead: false,
      },
    })

    return NextResponse.json({ unread_count: count })
  } catch (error) {
    console.error('GET /api/notifications/unread-count error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
