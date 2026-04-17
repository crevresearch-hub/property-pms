import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; unitId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    const { id, unitId } = await params

    // Verify tenant belongs to the organization
    const tenant = await prisma.tenant.findFirst({
      where: { id: id, organizationId },
    })

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    // Verify unit belongs to the organization
    const unit = await prisma.unit.findFirst({
      where: { id: unitId, organizationId },
    })

    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
    }

    // Check if unit is already occupied by a different tenant
    if (unit.tenantId && unit.tenantId !== id) {
      return NextResponse.json(
        { error: 'Unit is already assigned to another tenant' },
        { status: 409 }
      )
    }

    // Assign tenant to unit
    const updatedUnit = await prisma.unit.update({
      where: { id: unitId },
      data: {
        tenantId: id,
        status: 'Occupied',
      },
      include: {
        tenant: {
          select: { id: true, name: true },
        },
      },
    })

    await logActivity(
      organizationId,
      session.user.name,
      'Assigned Tenant to Unit',
      `Tenant ${tenant.name} assigned to unit ${unit.unitNo}`
    )

    return NextResponse.json(updatedUnit)
  } catch (error) {
    console.error('POST /api/tenants/[id]/assign/[unitId] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
