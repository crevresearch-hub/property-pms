import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { logActivity } from '@/lib/activity'

const aed = (n: number) => `AED ${Number(n || 0).toLocaleString()}`

const UPFRONT_PREFIX = 'UPFRONT_JSON:'
function parseUpfront(notes: string | undefined | null): {
  cash: number
  chequeAmount: number
  chequeNo: string
  bankName: string
  chequeDate: string
} {
  const def = { cash: 0, chequeAmount: 0, chequeNo: '', bankName: '', chequeDate: '' }
  if (!notes) return def
  for (const line of notes.split('\n')) {
    if (line.startsWith(UPFRONT_PREFIX)) {
      try { return { ...def, ...JSON.parse(line.slice(UPFRONT_PREFIX.length)) } } catch { /* ignore */ }
    }
  }
  return def
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const organizationId = session.user.organizationId
    const { id } = await params

    const tenant = await prisma.tenant.findFirst({
      where: { id, organizationId },
      include: { units: { select: { unitNo: true } } },
    })
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    if (!tenant.email) {
      return NextResponse.json({ error: 'Tenant has no email on file.' }, { status: 400 })
    }

    const contract = await prisma.tenancyContract.findFirst({
      where: { organizationId, tenantId: id },
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
    })
    if (!contract) return NextResponse.json({ error: 'No contract found' }, { status: 404 })

    const cheques = await prisma.cheque.findMany({
      where: { organizationId, tenantId: id },
      orderBy: { sequenceNo: 'asc' },
    })

    const upfront = parseUpfront(contract.notes)
    const upfrontTotal = upfront.cash + upfront.chequeAmount
    const collectedFromCheques = cheques
      .filter((c) => c.status === 'Cleared' && !(c.sequenceNo === 1 && c.paymentType === 'Upfront'))
      .reduce((s, c) => s + (c.amount || 0), 0)
    const totalPaid = upfrontTotal + collectedFromCheques
    const annualRent = contract.rentAmount || 0
    const remaining = Math.max(0, annualRent - totalPaid)

    // Cheque table rows
    const chequeRows = cheques.map((c) => {
      const isUpfront = c.sequenceNo === 1 && c.paymentType === 'Upfront'
      const statusBadge = c.status === 'Cleared'
        ? '<span style="background:#d1fae5;color:#065f46;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;">CLEARED ✓</span>'
        : c.status === 'Bounced'
        ? '<span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;">BOUNCED ✕</span>'
        : c.status === 'Deposited'
        ? '<span style="background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;">DEPOSITED</span>'
        : '<span style="background:#f3f4f6;color:#374151;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;">PENDING</span>'
      return `<tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:8px 12px;font-size:12px;">
          ${isUpfront ? `<strong>Cheque ${c.sequenceNo} (Upfront)</strong>` : `Cheque ${c.sequenceNo}`}
        </td>
        <td style="padding:8px 12px;font-size:12px;font-family:monospace;">${c.chequeNo || '—'}</td>
        <td style="padding:8px 12px;font-size:12px;">${c.bankName || '—'}</td>
        <td style="padding:8px 12px;font-size:12px;">${c.chequeDate || '—'}</td>
        <td style="padding:8px 12px;font-size:12px;text-align:right;font-weight:600;">${aed(c.amount)}</td>
        <td style="padding:8px 12px;font-size:12px;">${statusBadge}</td>
      </tr>`
    }).join('\n')

    const today = new Date().toLocaleDateString('en-GB')
    const unitNo = tenant.units?.[0]?.unitNo || '—'

    const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#111;">
      <div style="max-width:680px;margin:24px auto;padding:32px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;">
        <div style="border-bottom:3px solid #E30613;padding-bottom:14px;margin-bottom:18px;">
          <h1 style="margin:0;font-size:22px;color:#E30613;">Rent Payment Status</h1>
          <p style="margin:4px 0 0 0;font-size:12px;color:#6b7280;">CRE L.L.C. · ${today}</p>
        </div>

        <p style="margin:0 0 14px 0;">Dear ${tenant.name.replace(/[<>]/g, '')},</p>
        <p style="margin:0 0 18px 0;">Here is the current status of your rent payments under contract <strong>${contract.contractNo}</strong>.</p>

        <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
          <tr><td style="padding:6px 12px;background:#fafafa;font-size:11px;color:#6b7280;width:35%;">Unit</td><td style="padding:6px 12px;font-size:12px;">${unitNo}</td></tr>
          <tr><td style="padding:6px 12px;background:#fafafa;font-size:11px;color:#6b7280;">Contract Period</td><td style="padding:6px 12px;font-size:12px;">${contract.contractStart} → ${contract.contractEnd}</td></tr>
          <tr><td style="padding:6px 12px;background:#fafafa;font-size:11px;color:#6b7280;">Annual Rent</td><td style="padding:6px 12px;font-size:12px;font-weight:600;">${aed(annualRent)}</td></tr>
        </table>

        <div style="display:flex;gap:8px;margin-bottom:18px;">
          <div style="flex:1;background:#dbeafe;border:1px solid #93c5fd;border-radius:8px;padding:10px;">
            <p style="margin:0;font-size:10px;color:#1e40af;font-weight:600;text-transform:uppercase;">Total Paid</p>
            <p style="margin:4px 0 0 0;font-size:18px;font-weight:700;color:#1e3a8a;">${aed(totalPaid)}</p>
          </div>
          <div style="flex:1;background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:10px;">
            <p style="margin:0;font-size:10px;color:#92400e;font-weight:600;text-transform:uppercase;">Remaining</p>
            <p style="margin:4px 0 0 0;font-size:18px;font-weight:700;color:#78350f;">${aed(remaining)}</p>
          </div>
        </div>

        <h3 style="margin:18px 0 8px 0;font-size:14px;">Cheque Schedule</h3>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;">#</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;">Cheque No.</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;">Bank</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;">Date</th>
              <th style="padding:8px 12px;text-align:right;font-size:11px;color:#6b7280;">Amount</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;">Status</th>
            </tr>
          </thead>
          <tbody>${chequeRows || '<tr><td colspan="6" style="padding:14px;text-align:center;color:#6b7280;font-size:12px;">No cheques recorded yet.</td></tr>'}</tbody>
        </table>

        ${upfront.cash > 0 ? `<p style="margin:14px 0 0 0;font-size:11px;color:#6b7280;">Upfront cash received: <strong>${aed(upfront.cash)}</strong></p>` : ''}

        <p style="margin:18px 0 0 0;font-size:11px;color:#6b7280;">
          For any queries, contact <a href="mailto:info@cre.ae" style="color:#E30613;">info@cre.ae</a>.
        </p>
      </div>
    </body></html>`

    const result = await sendEmail({
      organizationId,
      to: tenant.email,
      toName: tenant.name,
      subject: `Rent Status — ${contract.contractNo} (${aed(totalPaid)} of ${aed(annualRent)} paid)`,
      html,
      template: 'rent_status',
      triggeredBy: session.user.name,
      refType: 'tenant',
      refId: tenant.id,
    })

    await logActivity(
      organizationId,
      session.user.name,
      'Sent Rent Status',
      `${tenant.name} — ${aed(totalPaid)} paid of ${aed(annualRent)}`
    )

    return NextResponse.json({
      message: 'Rent status sent',
      totalPaid,
      remaining,
      emailSent: result.success,
      emailError: result.error || null,
    })
  } catch (error) {
    console.error('POST /api/tenants/[id]/rent-status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
