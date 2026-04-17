import { NextRequest, NextResponse } from 'next/server'
import { getTenantSession } from '@/lib/tenant-auth'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = getTenantSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const cheques = await prisma.cheque.findMany({
      where: { tenantId: session.id, organizationId: session.orgId },
      orderBy: [{ sequenceNo: 'asc' }, { chequeDate: 'asc' }],
    })
    return NextResponse.json(cheques)
  } catch (error) {
    console.error('GET /api/tenant/cheques error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
