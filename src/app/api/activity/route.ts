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

    const logs = await prisma.activityLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return NextResponse.json(logs)
  } catch (error) {
    console.error('GET /api/activity error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
