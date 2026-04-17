import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { createNotification } from '@/lib/notifications'
import { sendEmail } from '@/lib/email'
import { contractSentTemplate } from '@/lib/email-templates'

export async function POST(
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

    if (!existing.email) {
      return NextResponse.json({ error: 'Owner has no email on file' }, { status: 400 })
    }

    const now = new Date()

    const latestDraft = await prisma.ownerContract.findFirst({
      where: { organizationId, ownerId: id, status: 'Draft' },
      orderBy: { version: 'desc' },
    })
    const target =
      latestDraft ||
      (await prisma.ownerContract.findFirst({
        where: { organizationId, ownerId: id },
        orderBy: { version: 'desc' },
      }))

    let updatedContract: any = null
    if (target) {
      updatedContract = await prisma.ownerContract.update({
        where: { id: target.id },
        data: {
          status: 'Sent',
          sentAt: now,
          sentToEmail: existing.email,
        },
      })
    }

    // Dispatch email via the shared service (handles test mode + EmailLog persistence).
    let emailResult: { success: boolean; error?: string } = { success: true }
    if (updatedContract) {
      const baseUrl = process.env.NEXTAUTH_URL || ''
      const tpl = contractSentTemplate(existing as never, updatedContract as never, baseUrl)
      emailResult = await sendEmail({
        organizationId,
        to: existing.email,
        toName: existing.ownerName,
        subject: tpl.subject,
        html: tpl.html,
        template: 'contract_sent',
        triggeredBy: session.user.name,
        refType: 'owner',
        refId: existing.id,
      })
    }

    const updated = await prisma.propertyOwner.update({
      where: { id },
      data: {
        emailSentAt: now,
        stage: existing.stage === 'Lead' ? 'Proposal Sent' : existing.stage,
        proposalSentAt: existing.proposalSentAt || now,
      },
    })

    await createNotification(
      organizationId,
      'staff',
      '',
      'PM Agreement Sent',
      `Agreement emailed to ${existing.ownerName} (${existing.email}) for ${existing.buildingName}`,
      'system'
    )

    await logActivity(
      organizationId,
      session.user.name,
      'Emailed PM Agreement',
      `${existing.ownerName} <${existing.email}> – ${existing.buildingName}${updatedContract ? ` – ${updatedContract.contractNo} v${updatedContract.version}` : ''}`
    )

    let safeContract: any = null
    if (updatedContract) {
      const { htmlBody: _o, ...rest } = updatedContract
      safeContract = rest
    }

    return NextResponse.json({
      message: emailResult.success
        ? `Agreement email dispatched to ${existing.email}`
        : `Agreement send attempted but email provider failed: ${emailResult.error || 'unknown error'}`,
      emailSentAt: now.toISOString(),
      emailSuccess: emailResult.success,
      emailError: emailResult.error || null,
      owner: updated,
      contract: safeContract,
    })
  } catch (error) {
    console.error('POST /api/owners/[id]/send error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
