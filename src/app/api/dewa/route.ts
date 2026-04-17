import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    const { searchParams } = new URL(request.url)
    const unitIdFilter = searchParams.get('unit_id')

    const where: Record<string, unknown> = { organizationId }
    if (unitIdFilter) {
      where.unitId = unitIdFilter
    }

    const readings = await prisma.dewaReading.findMany({
      where,
      include: {
        unit: {
          select: { id: true, unitNo: true },
        },
        tenant: {
          select: { id: true, name: true, phone: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(readings)
  } catch (error) {
    console.error('GET /api/dewa error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    const body = await request.json()

    const {
      unitId,
      tenantId,
      premiseNo,
      month,
      electricityReading,
      waterReading,
      electricityCharge,
      waterCharge,
      sewageCharge,
      notes,
    } = body

    if (!unitId || !month) {
      return NextResponse.json(
        { error: 'Unit ID and month are required' },
        { status: 400 }
      )
    }

    // Verify unit belongs to organization
    const unit = await prisma.unit.findFirst({
      where: { id: unitId, organizationId },
    })
    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
    }

    // Verify tenant if provided
    if (tenantId) {
      const tenant = await prisma.tenant.findFirst({
        where: { id: tenantId, organizationId },
      })
      if (!tenant) {
        return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
      }
    }

    // Auto-calculate total charge
    const elecCharge = parseFloat(electricityCharge) || 0
    const watCharge = parseFloat(waterCharge) || 0
    const sewCharge = parseFloat(sewageCharge) || 0
    const totalCharge = elecCharge + watCharge + sewCharge

    const reading = await prisma.dewaReading.create({
      data: {
        organizationId,
        unitId,
        tenantId: tenantId || null,
        premiseNo: premiseNo || '',
        month,
        electricityReading: parseFloat(electricityReading) || 0,
        waterReading: parseFloat(waterReading) || 0,
        electricityCharge: elecCharge,
        waterCharge: watCharge,
        sewageCharge: sewCharge,
        totalCharge,
        status: 'Pending',
        notes: notes || '',
      },
      include: {
        unit: { select: { id: true, unitNo: true } },
        tenant: { select: { id: true, name: true } },
      },
    })

    await logActivity(
      organizationId,
      session.user.name,
      'Created DEWA Reading',
      `Unit ${unit.unitNo} - ${month} - Total: AED ${totalCharge.toFixed(2)}`
    )

    return NextResponse.json(reading, { status: 201 })
  } catch (error) {
    console.error('POST /api/dewa error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
