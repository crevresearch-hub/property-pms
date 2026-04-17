import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
// Email removed per user request - too many emails. Only: contract_sent, admin_owner_signed, final_package.
import { logActivity } from '@/lib/activity'
import { createNotification } from '@/lib/notifications'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contractId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    const { id, contractId } = await params

    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const signatureImage = String(body?.signatureImage || '')
    const signedByCREName = String(body?.signedByCREName || session.user.name || '').trim()

    if (!signatureImage.startsWith('data:image/png;base64,')) {
      return NextResponse.json({ error: 'Invalid signature image.' }, { status: 400 })
    }
    if (!signedByCREName) {
      return NextResponse.json({ error: 'Signer name is required.' }, { status: 400 })
    }

    const contract = await prisma.ownerContract.findFirst({
      where: { id: contractId, ownerId: id, organizationId },
      include: { owner: true },
    })
    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }
    if (contract.creSignedAt) {
      return NextResponse.json({ error: 'CRE has already counter-signed this contract.' }, { status: 410 })
    }

    const now = new Date()
    const bothSigned = !!contract.ownerSignedAt
    const newStatus = bothSigned ? 'Active' : 'Sent'

    // If activating, supersede any other Active contract for this owner
    if (bothSigned) {
      await prisma.ownerContract.updateMany({
        where: {
          organizationId,
          ownerId: id,
          status: 'Active',
          id: { not: contractId },
        },
        data: { status: 'Superseded', supersededById: contractId },
      })
    }

    const updated = await prisma.ownerContract.update({
      where: { id: contractId },
      data: {
        creSignatureImage: signatureImage,
        signedByCREName,
        creSignedBy: session.user.name || '',
        creSignedAt: now,
        status: newStatus,
        signedAt: bothSigned ? now : contract.signedAt,
      },
    })

    await prisma.propertyOwner.update({
      where: { id },
      data: {
        signedByCRE: true,
        contractSignedAt: bothSigned ? now : contract.owner.contractSignedAt,
        stage: bothSigned ? 'Contract Signed' : contract.owner.stage,
      },
    })

    await logActivity(
      organizationId,
      session.user.name,
      'Counter-Signed PM Contract',
      `${contract.contractNo} v${contract.version} by ${signedByCREName}`
    )

    await createNotification(
      organizationId,
      'staff',
      '',
      'Contract Counter-Signed',
      `${contract.contractNo} counter-signed by ${signedByCREName}${bothSigned ? ' — now Active' : ''}`,
      'system'
    )

    // Email removed per user request - too many emails. Only: contract_sent, admin_owner_signed, final_package.

    const { htmlBody: _omit, ...safe } = updated
    return NextResponse.json({
      message: 'Counter-signature recorded',
      contract: safe,
      bothSigned,
    })
  } catch (error) {
    console.error('POST /api/owners/[id]/contracts/[contractId]/cre-sign error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
