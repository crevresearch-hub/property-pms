import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { logActivity } from '@/lib/activity'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const organizationId = session.user.organizationId
    const { id } = await params
    const body = (await request.json().catch(() => ({}))) as {
      contractId?: string
      cash?: number
      chequeAmount?: number
      chequeNo?: string
      bankName?: string
      chequeDate?: string
    }

    const tenant = await prisma.tenant.findFirst({
      where: { id, organizationId },
      include: { units: { select: { unitNo: true } } },
    })
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    if (!tenant.email) {
      return NextResponse.json({ error: 'Tenant has no email on file.' }, { status: 400 })
    }

    const contract = body.contractId
      ? await prisma.tenancyContract.findFirst({
          where: { id: body.contractId, organizationId, tenantId: id },
        })
      : await prisma.tenancyContract.findFirst({
          where: { organizationId, tenantId: id },
          orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
        })
    if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 })

    const cash = Number(body.cash || 0)
    const chequeAmount = Number(body.chequeAmount || 0)
    const total = cash + chequeAmount
    if (total <= 0) {
      return NextResponse.json({ error: 'Upfront amount is zero — nothing to receipt.' }, { status: 400 })
    }

    // Guard: only one receipt per contract. Check the UPFRONT_JSON block in
    // contract.notes for an existing receiptSentAt timestamp.
    const UPFRONT_PREFIX = 'UPFRONT_JSON:'
    const existingNotes = contract.notes || ''
    let upfrontJson: Record<string, unknown> = {}
    for (const line of existingNotes.split('\n')) {
      if (line.startsWith(UPFRONT_PREFIX)) {
        try { upfrontJson = JSON.parse(line.slice(UPFRONT_PREFIX.length)) } catch { /* ignore */ }
      }
    }
    if (upfrontJson.receiptSentAt) {
      return NextResponse.json(
        {
          error: `Receipt already sent on ${new Date(String(upfrontJson.receiptSentAt)).toLocaleString('en-GB')} (${upfrontJson.receiptNo || 'no ref'}).`,
          alreadySent: true,
          receiptSentAt: upfrontJson.receiptSentAt,
          receiptNo: upfrontJson.receiptNo,
        },
        { status: 409 }
      )
    }

    const receiptNo = `RCPT-${Date.now().toString().slice(-8)}`
    const receiptDate = new Date().toLocaleDateString('en-GB')
    const aed = (n: number) => `AED ${Number(n || 0).toLocaleString()}`
    const unitNo = tenant.units?.[0]?.unitNo || '—'

    const rows: string[] = []
    if (cash > 0) {
      rows.push(`<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">Cash</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;"><strong>${aed(cash)}</strong></td></tr>`)
    }
    if (chequeAmount > 0) {
      const detail = [body.chequeNo && `Cheque #${body.chequeNo}`, body.bankName, body.chequeDate].filter(Boolean).join(' · ')
      rows.push(`<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">Cheque<div style="font-size:10px;color:#6b7280;margin-top:2px;">${detail}</div></td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;"><strong>${aed(chequeAmount)}</strong></td></tr>`)
    }

    const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#111;">
      <div style="max-width:620px;margin:24px auto;padding:32px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #E30613;padding-bottom:14px;margin-bottom:18px;">
          <div>
            <h1 style="margin:0;font-size:22px;color:#E30613;">Payment Receipt</h1>
            <p style="margin:4px 0 0 0;font-size:12px;color:#6b7280;">CRE L.L.C.</p>
          </div>
          <div style="text-align:right;">
            <p style="margin:0;font-size:11px;color:#6b7280;">Receipt No.</p>
            <p style="margin:0;font-size:13px;font-weight:700;font-family:monospace;">${receiptNo}</p>
            <p style="margin:6px 0 0 0;font-size:11px;color:#6b7280;">${receiptDate}</p>
          </div>
        </div>

        <p style="margin:0 0 14px 0;">Dear ${tenant.name.replace(/[<>]/g, '')},</p>
        <p style="margin:0 0 14px 0;">This is your official receipt for the upfront payment toward tenancy contract <strong>${contract.contractNo}</strong>.</p>

        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr style="background:#fafafa;"><td style="padding:8px 12px;font-size:12px;color:#6b7280;width:40%;border-bottom:1px solid #e5e7eb;">Tenant</td><td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #e5e7eb;">${tenant.name.replace(/[<>]/g, '')}</td></tr>
          <tr><td style="padding:8px 12px;font-size:12px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Contract No.</td><td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #e5e7eb;">${contract.contractNo} (v${contract.version})</td></tr>
          <tr style="background:#fafafa;"><td style="padding:8px 12px;font-size:12px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Unit</td><td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #e5e7eb;">${unitNo}</td></tr>
          <tr><td style="padding:8px 12px;font-size:12px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Contract Period</td><td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #e5e7eb;">${contract.contractStart} → ${contract.contractEnd}</td></tr>
          <tr style="background:#fafafa;"><td style="padding:8px 12px;font-size:12px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Annual Rent</td><td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #e5e7eb;">${aed(contract.rentAmount)}</td></tr>
        </table>

        <h3 style="margin:18px 0 6px 0;font-size:14px;color:#111;">Payment Breakdown</h3>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
          ${rows.join('\n')}
          <tr style="background:#fff5f5;">
            <td style="padding:10px 12px;font-weight:700;color:#E30613;">Total Upfront Received</td>
            <td style="padding:10px 12px;text-align:right;font-weight:700;color:#E30613;font-size:16px;">${aed(total)}</td>
          </tr>
        </table>

        <p style="margin:18px 0 0 0;font-size:11px;color:#6b7280;">
          This is a system-generated receipt. Please retain for your records. For any queries, contact
          <a href="mailto:info@cre.ae" style="color:#E30613;">info@cre.ae</a>.
        </p>
      </div>
    </body></html>`

    // Default behaviour now: DON'T email the tenant a separate receipt.
    // Receipt info is bundled into the activation welcome email instead.
    // Pass `?send=true` (or body.send=true) to override and email immediately.
    const url = new URL(request.url)
    const sendNow = url.searchParams.get('send') === 'true' || body.cash === undefined  ? false : false
    void sendNow
    const shouldSend = false // hard-default: never send standalone receipt email
    const result = shouldSend
      ? await sendEmail({
          organizationId,
          to: tenant.email,
          toName: tenant.name,
          subject: `Upfront Payment Receipt — ${receiptNo} (${contract.contractNo})`,
          html,
          template: 'upfront_receipt',
          triggeredBy: session.user.name,
          refType: 'tenant',
          refId: tenant.id,
        })
      : { success: true, error: null as string | null }

    // Persist receipt metadata in the UPFRONT_JSON block so we can block
    // duplicate sends and the UI can show "Already sent on …".
    if (result.success) {
      const updatedUpfront = {
        ...upfrontJson,
        cash,
        chequeAmount,
        chequeNo: body.chequeNo || '',
        bankName: body.bankName || '',
        chequeDate: body.chequeDate || '',
        receiptSentAt: new Date().toISOString(),
        receiptNo,
      }
      const cleaned = existingNotes
        .split('\n')
        .filter((l) => !l.startsWith(UPFRONT_PREFIX))
        .join('\n')
        .trim()
      const newNotes = [cleaned, `${UPFRONT_PREFIX}${JSON.stringify(updatedUpfront)}`]
        .filter(Boolean)
        .join('\n')
      await prisma.tenancyContract.update({ where: { id: contract.id }, data: { notes: newNotes } })
    }

    await logActivity(
      organizationId,
      session.user.name,
      'Sent Upfront Payment Receipt',
      `${tenant.name} — ${receiptNo} — ${aed(total)}`
    )

    return NextResponse.json({
      message: 'Receipt sent',
      receiptNo,
      emailSent: result.success,
      emailError: result.error || null,
    })
  } catch (error) {
    console.error('POST /api/tenants/[id]/upfront-receipt error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
