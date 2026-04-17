import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { createNotification } from '@/lib/notifications'
import { sendEmail } from '@/lib/email'
import { contractSignedTemplate } from '@/lib/email-templates'

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

    const body = await request.json().catch(() => ({} as any))
    const signedByOwnerName = String(body?.signedByOwnerName || '')
    const signedByCREName = String(body?.signedByCREName || session.user.name || '')

    const existing = await prisma.propertyOwner.findFirst({
      where: { id, organizationId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Owner not found' }, { status: 404 })
    }

    const now = new Date()

    // Find latest Sent contract; fall back to most recent contract
    const latestSent = await prisma.ownerContract.findFirst({
      where: { organizationId, ownerId: id, status: 'Sent' },
      orderBy: { version: 'desc' },
    })
    const target =
      latestSent ||
      (await prisma.ownerContract.findFirst({
        where: { organizationId, ownerId: id },
        orderBy: { version: 'desc' },
      }))

    let updatedContract: any = null
    if (target) {
      // Mark any existing Active contracts (except this one) as Superseded
      await prisma.ownerContract.updateMany({
        where: {
          organizationId,
          ownerId: id,
          status: 'Active',
          id: { not: target.id },
        },
        data: { status: 'Superseded', supersededById: target.id },
      })

      updatedContract = await prisma.ownerContract.update({
        where: { id: target.id },
        data: {
          status: 'Active',
          signedAt: target.signedAt || now,
          signedByOwnerName: signedByOwnerName || existing.ownerName,
          signedByCREName,
        },
      })
    }

    const updated = await prisma.propertyOwner.update({
      where: { id },
      data: {
        signedByOwner: true,
        signedByCRE: true,
        contractSignedAt: now,
        stage: 'Contract Signed',
      },
    })

    await createNotification(
      organizationId,
      'staff',
      '',
      'PM Agreement Signed',
      `${existing.ownerName} has signed the PM Agreement for ${existing.buildingName}`,
      'system'
    )

    await logActivity(
      organizationId,
      session.user.name,
      'PM Agreement Signed',
      `${existing.ownerName} – ${existing.buildingName}${updatedContract ? ` – ${updatedContract.contractNo} v${updatedContract.version}` : ''}`
    )

    if (updatedContract && existing.email) {
      const baseUrl = process.env.NEXTAUTH_URL || ''
      const tpl = contractSignedTemplate(existing as never, updatedContract as never, baseUrl)
      await sendEmail({
        organizationId,
        to: existing.email,
        toName: existing.ownerName,
        subject: tpl.subject,
        html: tpl.html,
        template: 'contract_signed',
        triggeredBy: session.user.name,
        refType: 'owner',
        refId: existing.id,
      })
    }

    let safeContract: any = null
    if (updatedContract) {
      const { htmlBody: _o, ...rest } = updatedContract
      safeContract = rest
    }

    return NextResponse.json({
      message: 'Contract marked as signed',
      owner: updated,
      contract: safeContract,
    })
  } catch (error) {
    console.error('POST /api/owners/[id]/sign error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
