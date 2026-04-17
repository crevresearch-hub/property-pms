import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId

    const renewal = await prisma.renewalRequest.findFirst({
      where: { id: id, organizationId },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            emiratesId: true,
            passportNo: true,
            nationality: true,
          },
        },
        unit: {
          select: {
            id: true,
            unitNo: true,
            unitType: true,
            currentRent: true,
            contractStart: true,
            contractEnd: true,
            status: true,
          },
        },
      },
    })

    if (!renewal) {
      return NextResponse.json({ error: 'Renewal request not found' }, { status: 404 })
    }

    // Fetch contract history for context
    const contractHistory = await prisma.contractHistory.findMany({
      where: {
        organizationId,
        unitId: renewal.unitId,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    return NextResponse.json({
      ...renewal,
      contractHistory,
    })
  } catch (error) {
    console.error('GET /api/renewals/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
