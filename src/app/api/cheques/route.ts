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
    const tenantIdFilter = searchParams.get('tenant_id')
    const unitIdFilter = searchParams.get('unit_id')

    const where: Record<string, unknown> = { organizationId }
    if (tenantIdFilter) {
      where.tenantId = tenantIdFilter
    }
    if (unitIdFilter) {
      where.unitId = unitIdFilter
    }

    const cheques = await prisma.cheque.findMany({
      where,
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        unit: {
          select: {
            id: true,
            unitNo: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(cheques)
  } catch (error) {
    console.error('GET /api/cheques error:', error)
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
      tenantId,
      unitId,
      chequeNo,
      chequeDate,
      amount,
      bankName,
      status,
      paymentType,
      periodFrom,
      periodTo,
      sequenceNo,
      totalCheques,
      notes,
    } = body

    if (!tenantId || !amount) {
      return NextResponse.json(
        { error: 'Tenant ID and amount are required' },
        { status: 400 }
      )
    }

    // Verify tenant belongs to organization
    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId, organizationId },
    })
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    // Verify unit belongs to organization if provided
    if (unitId) {
      const unit = await prisma.unit.findFirst({
        where: { id: unitId, organizationId },
      })
      if (!unit) {
        return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
      }
    }

    const cheque = await prisma.cheque.create({
      data: {
        organizationId,
        tenantId,
        unitId: unitId || null,
        chequeNo: chequeNo || '',
        chequeDate: chequeDate || '',
        amount: parseFloat(amount),
        bankName: bankName || '',
        status: status || 'Received',
        paymentType: paymentType || 'Rent',
        periodFrom: periodFrom || '',
        periodTo: periodTo || '',
        sequenceNo: sequenceNo ? parseInt(sequenceNo, 10) : 1,
        totalCheques: totalCheques ? parseInt(totalCheques, 10) : 12,
        notes: notes || '',
      },
      include: {
        tenant: {
          select: { id: true, name: true },
        },
        unit: {
          select: { id: true, unitNo: true },
        },
      },
    })

    await logActivity(
      organizationId,
      session.user.name,
      'Created Cheque',
      `Cheque ${chequeNo || 'N/A'} for AED ${parseFloat(amount).toFixed(2)} added for tenant ${tenant.name}`
    )

    return NextResponse.json(cheque, { status: 201 })
  } catch (error) {
    console.error('POST /api/cheques error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
