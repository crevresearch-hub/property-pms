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
  { params }: { params: Promise<{ id: string; contractId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    const { id, contractId } = await params

    const contract = await prisma.ownerContract.findFirst({
      where: { id: contractId, ownerId: id, organizationId },
      include: { owner: true },
    })
    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }
    if (!contract.owner.email) {
      return NextResponse.json({ error: 'Owner has no email on file' }, { status: 400 })
    }

    const now = new Date()
    const baseUrl = process.env.NEXTAUTH_URL || ''
    const tpl = contractSentTemplate(contract.owner as never, contract as never, baseUrl)

    const emailResult = await sendEmail({
      organizationId,
      to: contract.owner.email,
      toName: contract.owner.ownerName,
      subject: tpl.subject,
      html: tpl.html,
      template: 'contract_sent',
      triggeredBy: session.user.name,
      refType: 'owner',
      refId: contract.owner.id,
    })

    const updatedContract = await prisma.ownerContract.update({
      where: { id: contract.id },
      data: {
        status: contract.status === 'Draft' ? 'Sent' : contract.status,
        sentAt: now,
        sentToEmail: contract.owner.email,
      },
    })

    await prisma.propertyOwner.update({
      where: { id },
      data: {
        emailSentAt: now,
        contractSentAt: contract.owner.contractSentAt || now,
        proposalSentAt: contract.owner.proposalSentAt || now,
        stage: contract.owner.stage === 'Lead' ? 'Proposal Sent' : contract.owner.stage,
      },
    })

    await logActivity(
      organizationId,
      session.user.name,
      'Emailed PM Agreement',
      `${contract.contractNo} v${contract.version} → ${contract.owner.ownerName} <${contract.owner.email}>`
    )

    await createNotification(
      organizationId,
      'staff',
      '',
      'PM Agreement Sent',
      `${contract.contractNo} v${contract.version} emailed to ${contract.owner.ownerName}`,
      'system'
    )

    const { htmlBody: _o, ...safe } = updatedContract
    return NextResponse.json({
      message: emailResult.success
        ? `Email sent to ${contract.owner.email}`
        : `Email send failed: ${emailResult.error || 'unknown error'}`,
      emailSuccess: emailResult.success,
      emailError: emailResult.error || null,
      toEmail: contract.owner.email,
      contract: safe,
    })
  } catch (error) {
    console.error('POST /api/owners/[id]/contracts/[contractId]/send error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
