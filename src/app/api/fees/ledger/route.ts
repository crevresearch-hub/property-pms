import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId

    const entries = await prisma.feeLedger.findMany({
      where: { organizationId },
      include: {
        tenant: {
          select: { id: true, name: true },
        },
        unit: {
          select: { id: true, unitNo: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(entries)
  } catch (error) {
    console.error('GET /api/fees/ledger error:', error)
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

    const { tenantId, unitId, feeType, description, amount, beneficiary } = body

    if (!feeType || !amount) {
      return NextResponse.json(
        { error: 'feeType and amount are required' },
        { status: 400 }
      )
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

    // Verify unit if provided
    if (unitId) {
      const unit = await prisma.unit.findFirst({
        where: { id: unitId, organizationId },
      })
      if (!unit) {
        return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
      }
    }

    const entry = await prisma.feeLedger.create({
      data: {
        organizationId,
        tenantId: tenantId || null,
        unitId: unitId || null,
        feeType,
        description: description || '',
        amount: parseFloat(amount),
        beneficiary: beneficiary || 'CRE',
        status: 'Pending',
      },
      include: {
        tenant: { select: { id: true, name: true } },
        unit: { select: { id: true, unitNo: true } },
      },
    })

    await logActivity(
      organizationId,
      session.user.name,
      'Added Fee Entry',
      `${feeType} - AED ${parseFloat(amount).toFixed(2)}`
    )

    return NextResponse.json(entry, { status: 201 })
  } catch (error) {
    console.error('POST /api/fees/ledger error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
