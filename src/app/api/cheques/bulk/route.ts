import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

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
      bankName,
      paymentType,
      cheques,
    } = body

    if (!tenantId || !cheques || !Array.isArray(cheques) || cheques.length === 0) {
      return NextResponse.json(
        { error: 'Tenant ID and a non-empty cheques array are required' },
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

    const totalCheques = cheques.length

    const chequeData = cheques.map((c: {
      chequeNo?: string
      chequeDate?: string
      amount: number | string
      periodFrom?: string
      periodTo?: string
      notes?: string
    }, index: number) => ({
      organizationId,
      tenantId,
      unitId: unitId || null,
      chequeNo: c.chequeNo || '',
      chequeDate: c.chequeDate || '',
      amount: parseFloat(String(c.amount)),
      bankName: bankName || '',
      status: 'Received',
      paymentType: paymentType || 'Rent',
      periodFrom: c.periodFrom || '',
      periodTo: c.periodTo || '',
      sequenceNo: index + 1,
      totalCheques,
      notes: c.notes || '',
    }))

    // Validate all amounts are positive
    const invalidCheque = chequeData.find(c => isNaN(c.amount) || c.amount <= 0)
    if (invalidCheque) {
      return NextResponse.json(
        { error: 'All cheque amounts must be positive numbers' },
        { status: 400 }
      )
    }

    const result = await prisma.cheque.createMany({
      data: chequeData,
    })

    const totalAmount = chequeData.reduce((sum, c) => sum + c.amount, 0)

    await logActivity(
      organizationId,
      session.user.name,
      'Bulk Created Cheques',
      `${result.count} cheques totalling AED ${totalAmount.toFixed(2)} added for tenant ${tenant.name}`
    )

    // Fetch the created cheques to return them
    const createdCheques = await prisma.cheque.findMany({
      where: {
        organizationId,
        tenantId,
        createdAt: { gte: new Date(Date.now() - 5000) },
      },
      include: {
        tenant: { select: { id: true, name: true } },
        unit: { select: { id: true, unitNo: true } },
      },
      orderBy: { sequenceNo: 'asc' },
      take: totalCheques,
    })

    return NextResponse.json(
      { count: result.count, cheques: createdCheques },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/cheques/bulk error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
