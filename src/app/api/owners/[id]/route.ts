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
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    const { id } = await params

    const owner = await prisma.propertyOwner.findFirst({
      where: { id, organizationId },
    })
    if (!owner) {
      return NextResponse.json({ error: 'Owner not found' }, { status: 404 })
    }

    return NextResponse.json(owner)
  } catch (error) {
    console.error('GET /api/owners/[id] error:', error)
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

    const existing = await prisma.propertyOwner.findFirst({
      where: { id, organizationId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Owner not found' }, { status: 404 })
    }

    const allowed = [
      'ownerName', 'ownerType', 'emiratesId', 'passportNo', 'nationality',
      'email', 'phone', 'alternatePhone', 'address', 'iban', 'bankName', 'tradeLicense',
      'buildingName', 'buildingType', 'emirate', 'area', 'plotNo', 'makaniNo',
      'titleDeedNo', 'totalUnits', 'totalFloors', 'parkingSpaces', 'yearBuilt',
      'buildingDescription', 'serviceType', 'servicesIncluded',
      'leasingCommissionRes', 'leasingCommissionCom', 'managementFee',
      'renewalFeeRes', 'renewalFeeCom', 'maintenanceMarkup', 'customCommissionNotes',
      'contractStartDate', 'contractEndDate', 'contractTerm', 'noticePeriodDays',
      'autoRenew', 'exclusiveMandate', 'paymentFrequency', 'reportingFrequency',
      'approvalThreshold', 'stage', 'handoverDate', 'handoverChecklist',
      'contractDocPath', 'titleDeedDocPath', 'ownerIdDocPath', 'notes',
      'signedByOwner', 'signedByCRE',
    ]
    const intFields = new Set(['totalUnits', 'totalFloors', 'parkingSpaces', 'noticePeriodDays'])
    const floatFields = new Set([
      'leasingCommissionRes', 'leasingCommissionCom', 'managementFee',
      'renewalFeeRes', 'renewalFeeCom', 'maintenanceMarkup', 'approvalThreshold',
    ])
    const boolFields = new Set(['autoRenew', 'exclusiveMandate', 'signedByOwner', 'signedByCRE'])

    const updateData: Record<string, unknown> = {}
    for (const key of allowed) {
      if (body[key] !== undefined) {
        if (intFields.has(key)) updateData[key] = parseInt(body[key], 10) || 0
        else if (floatFields.has(key)) updateData[key] = Number(body[key]) || 0
        else if (boolFields.has(key)) updateData[key] = Boolean(body[key])
        else updateData[key] = body[key]
      }
    }

    const owner = await prisma.propertyOwner.update({
      where: { id },
      data: updateData,
    })

    if (body.stage && body.stage !== existing.stage) {
      await logActivity(
        organizationId,
        session.user.name,
        'Owner Stage Changed',
        `${owner.ownerName} (${owner.buildingName}): ${existing.stage} -> ${owner.stage}`
      )
    } else {
      await logActivity(
        organizationId,
        session.user.name,
        'Updated Property Owner',
        `${owner.ownerName} - ${owner.buildingName}`
      )
    }

    return NextResponse.json(owner)
  } catch (error) {
    console.error('PUT /api/owners/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    const { id } = await params

    const existing = await prisma.propertyOwner.findFirst({
      where: { id, organizationId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Owner not found' }, { status: 404 })
    }

    await prisma.propertyOwner.delete({ where: { id } })

    await logActivity(
      organizationId,
      session.user.name,
      'Deleted Property Owner',
      `${existing.ownerName} - ${existing.buildingName}`
    )

    return NextResponse.json({ message: 'Owner deleted' })
  } catch (error) {
    console.error('DELETE /api/owners/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
