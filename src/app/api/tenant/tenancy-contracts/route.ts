import { NextRequest, NextResponse } from 'next/server'
import { getTenantSession } from '@/lib/tenant-auth'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = getTenantSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const contracts = await prisma.tenancyContract.findMany({
      where: { tenantId: session.id, organizationId: session.orgId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        contractNo: true,
        version: true,
        status: true,
        contractStart: true,
        contractEnd: true,
        rentAmount: true,
        contractType: true,
        signedByTenantAt: true,
        signedByLandlordAt: true,
        signedFileName: true,
        signedFileSize: true,
        createdAt: true,
      },
    })
    return NextResponse.json(contracts)
  } catch (error) {
    console.error('GET /api/tenant/tenancy-contracts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
