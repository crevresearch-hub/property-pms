import { NextRequest, NextResponse } from 'next/server'
import { getTenantSession } from '@/lib/tenant-auth'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = getTenantSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const documents = await prisma.tenantDocument.findMany({
      where: { tenantId: session.id, organizationId: session.orgId },
      orderBy: { uploadedAt: 'desc' },
    })

    return NextResponse.json(documents)
  } catch (error) {
    console.error('GET /api/tenant/documents error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
