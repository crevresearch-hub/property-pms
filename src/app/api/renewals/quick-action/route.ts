import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { logActivity } from '@/lib/activity'

const aed = (n: number) => `AED ${Number(n || 0).toLocaleString()}`

/**
 * POST /api/renewals/quick-action
 * Body: { unitId, action: 'remind' | 'not-renew' | 'congrats', message? }
 *
 * - remind     → sends a renewal reminder email
 * - not-renew  → marks contract for non-renewal + emails tenant
 * - congrats   → sends a renewal-confirmed congratulations email (called
 *                after a new renewal contract has been issued)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const organizationId = session.user.organizationId
    const body = (await request.json().catch(() => ({}))) as {
      unitId?: string
      action?: 'remind' | 'not-renew' | 'congrats'
      message?: string
    }

    const action = body.action
    if (!action || !['remind', 'not-renew', 'congrats'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
    if (!body.unitId) {
      return NextResponse.json({ error: 'unitId required' }, { status: 400 })
    }

    const unit = await prisma.unit.findFirst({
      where: { id: body.unitId, organizationId },
      include: { tenant: true },
    })
    if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
    if (!unit.tenant?.email) {
      return NextResponse.json({ error: 'Tenant has no email on file' }, { status: 400 })
    }

    const baseUrl = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '')
    const safeName = unit.tenant.name.replace(/[<>]/g, '')

    let subject = ''
    let html = ''

    if (action === 'remind') {
      const daysLeft = Math.ceil(
        (new Date(unit.contractEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
      subject = `Lease Renewal Reminder — Unit ${unit.unitNo}`
      html = `<!doctype html><html><body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,sans-serif;color:#111;">
        <div style="max-width:600px;margin:24px auto;padding:32px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;">
          <div style="height:4px;width:60px;background:#E30613;border-radius:2px;margin-bottom:20px;"></div>
          <h1 style="margin:0 0 12px 0;font-size:22px;color:#111;">Lease Renewal — Friendly Reminder</h1>
          <p>Dear ${safeName},</p>
          <p>This is a reminder that your lease for <strong>Unit ${unit.unitNo}</strong> ends on <strong>${unit.contractEnd}</strong>${daysLeft > 0 ? ` (${daysLeft} days from today)` : ''}.</p>
          <p>If you would like to renew, please reply to this email or contact us at <a href="mailto:info@cre.ae" style="color:#E30613;">info@cre.ae</a> so we can prepare a new contract.</p>
          <p style="margin:14px 0;padding:12px;background:#fff5f5;border-left:4px solid #E30613;border-radius:4px;">
            <strong>Current annual rent:</strong> ${aed(unit.currentRent)}
          </p>
          ${body.message ? `<p style="margin:14px 0;padding:12px;background:#f9fafb;border-radius:6px;font-size:13px;">${String(body.message).replace(/[<>]/g, '')}</p>` : ''}
          <p style="margin:18px 0 0 0;font-size:11px;color:#6b7280;">— Continental Real Estate</p>
        </div>
      </body></html>`
    } else if (action === 'not-renew') {
      // Create a renewal request flagged Tenant Declined / Not Renewing.
      await prisma.renewalRequest.create({
        data: {
          organizationId,
          unitId: unit.id,
          tenantId: unit.tenantId || '',
          currentRent: unit.currentRent,
          status: 'Not Renewing',
          newStartDate: '',
          newEndDate: '',
          tenantNotes: body.message || '',
          staffNotes: 'Marked Not Renewing via quick-action',
        },
      })
      subject = `Lease End Confirmation — Unit ${unit.unitNo}`
      html = `<!doctype html><html><body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,sans-serif;color:#111;">
        <div style="max-width:600px;margin:24px auto;padding:32px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;">
          <div style="height:4px;width:60px;background:#E30613;border-radius:2px;margin-bottom:20px;"></div>
          <h1 style="margin:0 0 12px 0;font-size:22px;">Lease Will End on ${unit.contractEnd}</h1>
          <p>Dear ${safeName},</p>
          <p>This is to confirm that your lease for <strong>Unit ${unit.unitNo}</strong> will <strong>not be renewed</strong>. The contract ends on <strong>${unit.contractEnd}</strong>.</p>
          <p>Please coordinate with us regarding the move-out inspection, security deposit refund, and final settlement.</p>
          ${body.message ? `<p style="margin:14px 0;padding:12px;background:#f9fafb;border-radius:6px;font-size:13px;">${String(body.message).replace(/[<>]/g, '')}</p>` : ''}
          <p style="margin:18px 0 0 0;font-size:11px;color:#6b7280;">For any questions: <a href="mailto:info@cre.ae" style="color:#E30613;">info@cre.ae</a></p>
        </div>
      </body></html>`
    } else if (action === 'congrats') {
      subject = `🎉 Lease Renewed — Unit ${unit.unitNo}`
      html = `<!doctype html><html><body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,sans-serif;color:#111;">
        <div style="max-width:600px;margin:24px auto;padding:32px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;">
          <div style="height:4px;width:60px;background:#10b981;border-radius:2px;margin-bottom:20px;"></div>
          <h1 style="margin:0 0 12px 0;font-size:22px;color:#065f46;">🎉 Congratulations on Your Lease Renewal!</h1>
          <p>Dear ${safeName},</p>
          <p>Your lease for <strong>Unit ${unit.unitNo}</strong> has been renewed. We are delighted to continue having you as our valued tenant.</p>
          <p>You will receive the new tenancy contract shortly for your signature. Once signed, the cheque schedule and Ejari renewal will be arranged.</p>
          ${body.message ? `<p style="margin:14px 0;padding:12px;background:#ecfdf5;border-radius:6px;font-size:13px;color:#065f46;">${String(body.message).replace(/[<>]/g, '')}</p>` : ''}
          <p style="margin:18px 0 0 0;font-size:11px;color:#6b7280;">— Continental Real Estate</p>
        </div>
      </body></html>`
    }

    const result = await sendEmail({
      organizationId,
      to: unit.tenant.email,
      toName: unit.tenant.name,
      subject,
      html,
      template: `renewal_${action}`,
      triggeredBy: session.user.name,
      refType: 'tenant',
      refId: unit.tenantId || unit.id,
    })

    await logActivity(
      organizationId,
      session.user.name,
      `Renewal: ${action}`,
      `${unit.unitNo} — ${unit.tenant.name}`
    )

    return NextResponse.json({
      message: 'Action sent',
      emailSent: result.success,
      emailError: result.error || null,
    })
  } catch (error) {
    console.error('POST /api/renewals/quick-action error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
