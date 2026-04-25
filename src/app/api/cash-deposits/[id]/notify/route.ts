import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { cashDepositNotificationTemplate } from '@/lib/email-templates'
import { createNotification } from '@/lib/notifications'
import { logActivity } from '@/lib/activity'

// Re-fire the owner email + in-app notification for a cash deposit.
// Used when the accountant edits a row or the owner says "I didn't see it".
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const organizationId = session.user.organizationId
    const { id } = await params
    const dep = await prisma.cashDeposit.findFirst({ where: { id, organizationId } })
    if (!dep) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!dep.ownerId) return NextResponse.json({ error: 'No owner attached to this deposit' }, { status: 400 })

    const owner = await prisma.propertyOwner.findFirst({
      where: { id: dep.ownerId, organizationId },
      select: { id: true, ownerName: true, email: true, buildingName: true },
    })
    if (!owner?.email) {
      return NextResponse.json({ error: 'Owner has no email on file' }, { status: 400 })
    }

    const baseUrl = process.env.NEXTAUTH_URL || ''
    const tpl = cashDepositNotificationTemplate(
      { ownerName: owner.ownerName, buildingName: owner.buildingName },
      {
        amount: dep.amount,
        cashSource: dep.cashSource,
        tenantName: dep.tenantName,
        unitNo: dep.unitNo,
        bankName: dep.bankName,
        accountNo: dep.accountNo,
        referenceNo: dep.referenceNo,
        depositedBy: dep.depositedBy,
        depositedAt: dep.depositedAt,
        notes: dep.notes,
      },
      baseUrl
    )

    const result = await sendEmail({
      organizationId,
      to: owner.email,
      toName: owner.ownerName,
      subject: tpl.subject,
      html: tpl.html,
      template: 'cash_deposit_notification_resend',
      triggeredBy: session.user.name,
      refType: 'cash_deposit',
      refId: dep.id,
    })

    await createNotification(
      organizationId,
      'owner',
      dep.ownerId,
      'Cash Deposit Reminder',
      `AED ${dep.amount.toLocaleString()} deposited on ${dep.depositedAt} (resent by ${session.user.name})`,
      'payment'
    ).catch(() => {})

    await logActivity(
      organizationId,
      session.user.name,
      'Resent Cash Deposit Email',
      `${owner.ownerName} <${owner.email}> · ref ${dep.referenceNo || '—'} · AED ${dep.amount.toLocaleString()}`
    )

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Email send failed' }, { status: 502 })
    }
    return NextResponse.json({ success: true, to: owner.email })
  } catch (error) {
    console.error('POST /api/cash-deposits/[id]/notify error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
