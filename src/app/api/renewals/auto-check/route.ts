import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { logActivity } from '@/lib/activity'
import { createNotification } from '@/lib/notifications'

/**
 * POST /api/renewals/auto-check
 *
 * Scans all occupied units and sends renewal notices at 90, 60, and 30 day
 * milestones. Uses EmailLog (template + refId) to avoid duplicates.
 */

type Milestone = 90 | 60 | 30

const TEMPLATE_PREFIX = 'renewal_notice_'

function templateName(days: Milestone): string {
  return `${TEMPLATE_PREFIX}${days}`
}

function buildNotice(opts: {
  tenantName: string
  unitNo: string
  contractEnd: string
  currentRent: number
  days: Milestone
  baseUrl: string
  contactEmail: string
}) {
  const { tenantName, unitNo, contractEnd, currentRent, days, baseUrl, contactEmail } = opts
  const urgency = days === 30 ? 'Urgent' : days === 60 ? 'Action Required' : 'Reminder'
  const subject = `[${urgency}] Lease Renewal Notice – Unit ${unitNo} expires ${contractEnd}`
  const loginUrl = `${baseUrl.replace(/\/$/, '')}/tenant/login`

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#111;">
  <div style="max-width:600px;margin:24px auto;padding:32px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;">
    <div style="height:4px;width:48px;background:#E30613;border-radius:2px;margin-bottom:20px;"></div>
    <h1 style="margin:0 0 14px 0;font-size:22px;">Lease Renewal Notice – ${days} days</h1>
    <p style="margin:0 0 12px 0;">Dear ${tenantName},</p>
    <p style="margin:0 0 12px 0;">
      Your tenancy for <strong>Unit ${unitNo}</strong> is scheduled to expire on
      <strong>${contractEnd}</strong> (${days} days from today).
    </p>
    <p style="margin:0 0 12px 0;">
      Current annual rent: <strong>AED ${currentRent.toLocaleString()}</strong>.
    </p>
    <p style="margin:0 0 12px 0;">Please choose one of the following options and let us know your decision:</p>
    <ol style="margin:0 0 16px 18px;padding:0;">
      <li style="margin-bottom:6px;"><strong>Renew</strong> at the existing terms</li>
      <li style="margin-bottom:6px;"><strong>Renew with revised rent</strong> (subject to RERA index)</li>
      <li style="margin-bottom:6px;"><strong>Vacate</strong> at the end of the current term</li>
    </ol>
    <div style="text-align:center;margin:20px 0;">
      <a href="${loginUrl}" style="display:inline-block;background:#E30613;color:#fff;padding:12px 24px;border-radius:6px;font-weight:bold;text-decoration:none;">
        Respond via Tenant Portal
      </a>
    </div>
    <p style="margin:16px 0 0 0;font-size:12px;color:#6b7280;">
      Under UAE law, the landlord must give at least 90 days written notice before
      changing rent or non-renewing. Please reply at your earliest convenience.
    </p>
    <p style="margin:12px 0 0 0;font-size:12px;color:#6b7280;">
      Questions? Contact us at <a href="mailto:${contactEmail}" style="color:#E30613;text-decoration:none;">${contactEmail}</a>.
    </p>
  </div>
</body></html>`

  return { subject, html }
}

async function alreadySent(
  organizationId: string,
  unitId: string,
  template: string
): Promise<boolean> {
  const log = await prisma.emailLog.findFirst({
    where: {
      organizationId,
      template,
      refType: 'unit',
      refId: unitId,
      status: { in: ['Sent', 'Queued'] },
    },
    select: { id: true },
  })
  return !!log
}

function pickMilestone(days: number): Milestone | null {
  if (days <= 30 && days > 0) return 30
  if (days <= 60 && days > 30) return 60
  if (days <= 90 && days > 60) return 90
  return null
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const organizationId = session.user.organizationId
    const baseUrl = process.env.NEXTAUTH_URL || ''
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { email: true },
    })
    const contactEmail = org?.email || 'info@cre.ae'

    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)
    const ninetyStr = new Date(now.getTime() + 90 * 86400000).toISOString().slice(0, 10)

    const units = await prisma.unit.findMany({
      where: {
        organizationId,
        status: 'Occupied',
        contractEnd: { gte: todayStr, lte: ninetyStr, not: '' },
      },
      include: { tenant: { select: { id: true, name: true, email: true } } },
    })

    let sent = 0
    let skipped = 0
    const actions: { unitNo: string; tenant: string; milestone: Milestone; status: string; reason?: string }[] = []

    for (const u of units) {
      if (!u.tenant || !u.tenant.email) {
        skipped++
        actions.push({ unitNo: u.unitNo, tenant: u.tenant?.name || '(none)', milestone: 90, status: 'skipped', reason: 'no email' })
        continue
      }

      const end = new Date(u.contractEnd)
      const days = Math.ceil((end.getTime() - now.getTime()) / 86400000)
      const milestone = pickMilestone(days)
      if (!milestone) {
        skipped++
        continue
      }

      const template = templateName(milestone)
      if (await alreadySent(organizationId, u.id, template)) {
        skipped++
        actions.push({ unitNo: u.unitNo, tenant: u.tenant.name, milestone, status: 'skipped', reason: 'already sent' })
        continue
      }

      const { subject, html } = buildNotice({
        tenantName: u.tenant.name,
        unitNo: u.unitNo,
        contractEnd: u.contractEnd,
        currentRent: u.currentRent,
        days: milestone,
        baseUrl,
        contactEmail,
      })

      const result = await sendEmail({
        organizationId,
        to: u.tenant.email,
        toName: u.tenant.name,
        subject,
        html,
        template,
        triggeredBy: session.user.name,
        refType: 'unit',
        refId: u.id,
      })

      if (result.success) {
        sent++
        actions.push({ unitNo: u.unitNo, tenant: u.tenant.name, milestone, status: 'sent' })
        await createNotification(
          organizationId,
          'staff',
          '',
          `Renewal notice sent (${milestone}d)`,
          `Unit ${u.unitNo} – ${u.tenant.name}`,
          'renewal'
        )
      } else {
        skipped++
        actions.push({ unitNo: u.unitNo, tenant: u.tenant.name, milestone, status: 'failed', reason: result.error })
      }
    }

    await logActivity(
      organizationId,
      session.user.name,
      'Ran Renewal Auto-Check',
      `${sent} sent, ${skipped} skipped across ${units.length} units`
    )

    return NextResponse.json({
      scanned: units.length,
      sent,
      skipped,
      actions,
    })
  } catch (error) {
    console.error('POST /api/renewals/auto-check error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
