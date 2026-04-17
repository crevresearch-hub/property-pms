import { NextRequest, NextResponse } from 'next/server'
import { getTenantSession } from '@/lib/tenant-auth'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = getTenantSession(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const violations = await prisma.violation.findMany({
      where: { tenantId: session.id, organizationId: session.orgId },
      include: { unit: { select: { unitNo: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(violations)
  } catch (error) {
    console.error('GET /api/tenant/violations error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
