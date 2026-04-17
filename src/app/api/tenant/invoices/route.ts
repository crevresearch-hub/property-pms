import { NextRequest, NextResponse } from 'next/server'
import { getTenantSession } from '@/lib/tenant-auth'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = getTenantSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const invoices = await prisma.invoice.findMany({
      where: { tenantId: session.id, organizationId: session.orgId },
      include: {
        unit: { select: { unitNo: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(invoices)
  } catch (error) {
    console.error('GET /api/tenant/invoices error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
