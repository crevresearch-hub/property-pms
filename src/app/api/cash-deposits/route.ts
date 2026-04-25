import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { sendEmail } from '@/lib/email'
import { cashDepositNotificationTemplate } from '@/lib/email-templates'
import { createNotification } from '@/lib/notifications'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const organizationId = session.user.organizationId
    const deposits = await prisma.cashDeposit.findMany({
      where: { organizationId },
      orderBy: [{ depositedAt: 'desc' }, { createdAt: 'desc' }],
    })
    return NextResponse.json(deposits)
  } catch (error) {
    console.error('GET /api/cash-deposits error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const organizationId = session.user.organizationId
    const body = await request.json()

    const amount = parseFloat(body.amount)
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Amount is required' }, { status: 400 })
    }
    if (!body.depositedAt) {
      return NextResponse.json({ error: 'Deposit date is required' }, { status: 400 })
    }

    const deposit = await prisma.cashDeposit.create({
      data: {
        organizationId,
        amount,
        cashSource: body.cashSource || '',
        tenantId: body.tenantId || null,
        tenantName: body.tenantName || '',
        unitNo: body.unitNo || '',
        ownerId: body.ownerId || null,
        ownerName: body.ownerName || '',
        bankName: body.bankName || '',
        accountNo: body.accountNo || '',
        referenceNo: body.referenceNo || '',
        depositedBy: body.depositedBy || session.user.name || '',
        depositedAt: body.depositedAt,
        status: body.status || 'Deposited',
        notes: body.notes || '',
      },
    })

    await logActivity(
      organizationId,
      session.user.name,
      'Recorded Cash Deposit',
      `AED ${amount.toLocaleString()} ${body.cashSource ? `(${body.cashSource})` : ''} → ${body.ownerName || 'owner'} · ref ${body.referenceNo || '—'}`
    )

    // Notify the owner by email + in-app notification (default true).
    const notifyOwner = body.notifyOwner !== false
    if (notifyOwner && body.ownerId) {
      const owner = await prisma.propertyOwner.findFirst({
        where: { id: body.ownerId, organizationId },
        select: { id: true, ownerName: true, email: true, buildingName: true },
      })
      if (owner?.email) {
        const baseUrl = process.env.NEXTAUTH_URL || ''
        const tpl = cashDepositNotificationTemplate(
          { ownerName: owner.ownerName, buildingName: owner.buildingName },
          {
            amount,
            cashSource: body.cashSource,
            tenantName: body.tenantName,
            unitNo: body.unitNo,
            bankName: body.bankName,
            accountNo: body.accountNo,
            referenceNo: body.referenceNo,
            depositedBy: deposit.depositedBy,
            depositedAt: deposit.depositedAt,
            notes: body.notes,
          },
          baseUrl
        )
        await sendEmail({
          organizationId,
          to: owner.email,
          toName: owner.ownerName,
          subject: tpl.subject,
          html: tpl.html,
          template: 'cash_deposit_notification',
          triggeredBy: session.user.name,
          refType: 'cash_deposit',
          refId: deposit.id,
        }).catch((e) => console.warn('Cash deposit email failed:', e))
      }
      await createNotification(
        organizationId,
        'owner',
        body.ownerId,
        'Cash Deposit Received',
        `AED ${amount.toLocaleString()} deposited to your account on ${deposit.depositedAt}`,
        'payment'
      ).catch(() => {})
    }

    return NextResponse.json(deposit, { status: 201 })
  } catch (error) {
    console.error('POST /api/cash-deposits error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
