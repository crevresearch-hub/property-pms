import { NextRequest, NextResponse } from 'next/server'
import { getTenantSession } from '@/lib/tenant-auth'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = getTenantSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const units = await prisma.unit.findMany({
      where: { tenantId: session.id, organizationId: session.orgId },
      select: {
        id: true,
        unitNo: true,
        unitType: true,
        contractStart: true,
        contractEnd: true,
        currentRent: true,
        status: true,
      },
      orderBy: { unitNo: 'asc' },
    })

    return NextResponse.json(units)
  } catch (error) {
    console.error('GET /api/tenant/unit error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
