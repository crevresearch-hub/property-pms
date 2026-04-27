import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { sendEmail } from '@/lib/email'

// Non-developer users (org admins, staff) submit unit-change requests via this
// endpoint. The request is logged in activity and emailed to the developer
// (admin@cre.ae). No DB model — the audit trail lives in the activity log + email.
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { unitId, unitNo, message } = body as { unitId?: string; unitNo?: string; message?: string }

    if (!unitId || !message || message.trim().length < 5) {
      return NextResponse.json({ error: 'unitId and message (min 5 chars) are required' }, { status: 400 })
    }

    const organizationId = session.user.organizationId

    const unit = await prisma.unit.findFirst({
      where: { id: unitId, organizationId },
      include: { tenant: { select: { name: true, email: true } } },
    })
    if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 })

    const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } })

    const subject = `Unit Update Request — ${unit.unitNo} (${org?.name || 'org'})`
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px;color:#111;">
        <h2 style="color:#E30613;">Unit Update Request</h2>
        <p style="color:#444;">A user has requested a change to a unit they do not have permission to edit directly.</p>
        <div style="background:#f5f5f5;border-radius:8px;padding:14px;margin:16px 0;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <tr><td style="color:#666;padding:4px 0;">Requested by:</td><td style="padding:4px 0;"><strong>${(session.user.name || session.user.email || 'unknown').replace(/[<>]/g, '')}</strong></td></tr>
            <tr><td style="color:#666;padding:4px 0;">Email:</td><td style="padding:4px 0;">${(session.user.email || '—').replace(/[<>]/g, '')}</td></tr>
            <tr><td style="color:#666;padding:4px 0;">Organization:</td><td style="padding:4px 0;">${(org?.name || '—').replace(/[<>]/g, '')}</td></tr>
            <tr><td style="color:#666;padding:4px 0;">Unit:</td><td style="padding:4px 0;"><strong>${(unit.unitNo || '').replace(/[<>]/g, '')}</strong> (${(unit.unitType || '—').replace(/[<>]/g, '')})</td></tr>
            <tr><td style="color:#666;padding:4px 0;">Current rent:</td><td style="padding:4px 0;">AED ${(unit.currentRent || 0).toLocaleString()}</td></tr>
            <tr><td style="color:#666;padding:4px 0;">Tenant:</td><td style="padding:4px 0;">${(unit.tenant?.name || '—').replace(/[<>]/g, '')}</td></tr>
            <tr><td style="color:#666;padding:4px 0;">Status:</td><td style="padding:4px 0;">${(unit.status || '—').replace(/[<>]/g, '')}</td></tr>
          </table>
        </div>
        <h3 style="font-size:14px;color:#222;margin-top:18px;">Requested change</h3>
        <div style="background:#fff;border:1px solid #ddd;border-radius:8px;padding:14px;color:#222;white-space:pre-wrap;">${message.trim().replace(/[<>]/g, '')}</div>
        <p style="margin-top:18px;color:#666;font-size:12px;">Submitted: ${new Date().toLocaleString()}</p>
      </div>`

    await sendEmail({
      organizationId,
      to: 'admin@cre.ae',
      toName: 'Developer',
      subject,
      html,
      template: 'unit_update_request',
      triggeredBy: session.user.name || session.user.email,
      refType: 'unit',
      refId: unit.id,
    }).catch((e) => console.warn('unit-update-request email failed:', e))

    await logActivity(
      organizationId,
      session.user.name || session.user.email || 'unknown',
      'Unit Update Requested',
      `Unit ${unit.unitNo}: ${message.trim().slice(0, 200)}`
    )

    return NextResponse.json({ ok: true, unitNo: unit.unitNo }, { status: 201 })
  } catch (error) {
    console.error('POST /api/unit-update-requests error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
