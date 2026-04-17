import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    const refId = request.nextUrl.searchParams.get('refId')
    const refType = request.nextUrl.searchParams.get('refType')

    const where: Record<string, unknown> = { organizationId }
    if (refId) where.refId = refId
    if (refType) where.refType = refType

    const logs = await prisma.emailLog.findMany({
      where: where as never,
      orderBy: { sentAt: 'desc' },
      take: 100,
    })

    return NextResponse.json({ logs })
  } catch (error) {
    console.error('GET /api/email-logs error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
