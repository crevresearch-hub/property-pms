import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

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

    const unit = await prisma.unit.findFirst({
      where: { id, organizationId },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            emiratesId: true,
          },
        },
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        maintenanceTickets: {
          orderBy: { submittedAt: 'desc' },
          take: 10,
        },
        cheques: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    })

    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
    }

    return NextResponse.json(unit)
  } catch (error) {
    console.error('GET /api/units/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    const { id } = await params
    const body = await request.json()

    // Verify unit belongs to the organization
    const existing = await prisma.unit.findFirst({
      where: { id, organizationId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
    }

    // If changing unitNo, check for duplicates
    if (body.unitNo && body.unitNo !== existing.unitNo) {
      const duplicate = await prisma.unit.findUnique({
        where: { organizationId_unitNo: { organizationId, unitNo: body.unitNo } },
      })
      if (duplicate) {
        return NextResponse.json({ error: 'Unit number already exists' }, { status: 409 })
      }
    }

    const unit = await prisma.unit.update({
      where: { id },
      data: {
        ...(body.unitNo !== undefined && { unitNo: body.unitNo }),
        ...(body.unitType !== undefined && { unitType: body.unitType }),
        ...(body.contractStart !== undefined && { contractStart: body.contractStart }),
        ...(body.contractEnd !== undefined && { contractEnd: body.contractEnd }),
        ...(body.currentRent !== undefined && { currentRent: parseFloat(body.currentRent) }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.tenantId !== undefined && { tenantId: body.tenantId || null }),
      },
      include: {
        tenant: {
          select: { id: true, name: true },
        },
      },
    })

    await logActivity(organizationId, session.user.name, 'Updated Unit', `Unit ${unit.unitNo} updated`)

    return NextResponse.json(unit)
  } catch (error) {
    console.error('PUT /api/units/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
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

    const unit = await prisma.unit.findFirst({
      where: { id, organizationId },
    })

    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
    }

    await prisma.unit.delete({
      where: { id },
    })

    await logActivity(organizationId, session.user.name, 'Deleted Unit', `Unit ${unit.unitNo} deleted`)

    return NextResponse.json({ message: 'Unit deleted successfully' })
  } catch (error) {
    console.error('DELETE /api/units/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
