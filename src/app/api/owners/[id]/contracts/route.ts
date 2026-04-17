import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { createNotification } from '@/lib/notifications'
import { createVersionedContract } from '@/lib/owner-contract-service'
// Email removed per user request - too many emails. Only: contract_sent, admin_owner_signed, final_package.

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
      select: { id: true },
    })
    if (!owner) {
      return NextResponse.json({ error: 'Owner not found' }, { status: 404 })
    }

    const contracts = await prisma.ownerContract.findMany({
      where: { organizationId, ownerId: id },
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        organizationId: true,
        ownerId: true,
        contractNo: true,
        version: true,
        status: true,
        serviceType: true,
        startDate: true,
        endDate: true,
        contractTerm: true,
        leasingCommissionRes: true,
        leasingCommissionCom: true,
        managementFee: true,
        renewalFeeRes: true,
        renewalFeeCom: true,
        noticePeriodDays: true,
        autoRenew: true,
        exclusiveMandate: true,
        paymentFrequency: true,
        signatureToken: true,
        generatedAt: true,
        sentAt: true,
        sentToEmail: true,
        signedAt: true,
        signedByOwnerName: true,
        signedByCREName: true,
        ownerIpAddress: true,
        signedFilePath: true,
        signedFileName: true,
        signedFileSize: true,
        uploadedAt: true,
        supersededById: true,
        reason: true,
        notes: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ contracts })
  } catch (error) {
    console.error('GET /api/owners/[id]/contracts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
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

    let reason = 'Initial contract'
    let notes = ''
    try {
      const body = await request.json()
      if (body?.reason) reason = String(body.reason)
      if (body?.notes) notes = String(body.notes)
    } catch {
      /* ignore */
    }

    const result = await createVersionedContract({
      organizationId,
      ownerId: id,
      reason,
      createdBy: session.user.name || '',
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    if (notes) {
      await prisma.ownerContract.update({
        where: { id: result.contract.id },
        data: { notes },
      })
    }

    await logActivity(
      organizationId,
      session.user.name,
      'Generated PM Contract (versioned)',
      `${result.contract.contractNo} v${result.contract.version} – ${result.owner.ownerName} – ${result.owner.buildingName} – ${reason}`
    )

    await createNotification(
      organizationId,
      'staff',
      '',
      'New Contract Generated',
      `${result.contract.contractNo} v${result.contract.version} for ${result.owner.ownerName} (${reason})`,
      'system'
    )

    // Email removed per user request - too many emails. Only: contract_sent, admin_owner_signed, final_package.

    const { htmlBody: _omit, ...safe } = result.contract
    return NextResponse.json({
      message: 'Contract created',
      contract: safe,
      owner: result.owner,
    }, { status: 201 })
  } catch (error) {
    console.error('POST /api/owners/[id]/contracts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
