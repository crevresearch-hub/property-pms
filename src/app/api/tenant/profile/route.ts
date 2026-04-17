import { NextRequest, NextResponse } from 'next/server'
import { getTenantSession } from '@/lib/tenant-auth'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = getTenantSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const tenant = await prisma.tenant.findFirst({
      where: { id: session.id, organizationId: session.orgId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        emiratesId: true,
        passportNo: true,
        nationality: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        status: true,
      },
    })

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    return NextResponse.json(tenant)
  } catch (error) {
    console.error('GET /api/tenant/profile error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
