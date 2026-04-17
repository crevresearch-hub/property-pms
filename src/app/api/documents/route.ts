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
    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status')

    const where: Record<string, unknown> = { organizationId }
    if (statusFilter) {
      where.status = statusFilter
    }

    const documents = await prisma.tenantDocument.findMany({
      where,
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            units: { select: { id: true, unitNo: true } },
          },
        },
      },
      orderBy: { uploadedAt: 'desc' },
    })

    return NextResponse.json(documents)
  } catch (error) {
    console.error('GET /api/documents error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
