import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { createNotification } from '@/lib/notifications'
import { sendEmail } from '@/lib/email'

const aed = (n: number) => `AED ${Number(n || 0).toLocaleString()}`

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

    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId },
      include: {
        tenant: { select: { id: true, name: true, email: true } },
        unit: { select: { id: true, unitNo: true } },
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Allow re-sending if needed (Draft OR Sent), block only Paid/Cancelled.
    if (['Paid', 'Cancelled', 'Void'].includes(invoice.status)) {
      return NextResponse.json(
        { error: `Cannot send a ${invoice.status} invoice` },
        { status: 400 }
      )
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: { status: 'Sent' },
      include: {
        tenant: { select: { id: true, name: true, email: true } },
        unit: { select: { id: true, unitNo: true } },
      },
    })

    // In-app notification
    if (invoice.tenantId) {
      const unitLabel = invoice.unit ? ` for unit ${invoice.unit.unitNo}` : ''
      await createNotification(
        organizationId,
        'tenant',
        invoice.tenantId,
        'New Invoice',
        `Invoice ${invoice.invoiceNo}${unitLabel} of ${aed(invoice.totalAmount)} is due on ${invoice.dueDate}.`,
        'payment'
      )
    }

    // Email tenant
    let emailSent = false
    let emailError: string | null = null
    if (invoice.tenant?.email) {
      const baseUrl = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '')
      const portalUrl = `${baseUrl}/tenant/login`
      const safeName = (invoice.tenant.name || '').replace(/[<>]/g, '')
      const safeInvoiceNo = (invoice.invoiceNo || '').replace(/[<>]/g, '')
      const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,sans-serif;color:#111;">
        <div style="max-width:620px;margin:24px auto;padding:32px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;">
          <div style="border-bottom:3px solid #E30613;padding-bottom:14px;margin-bottom:18px;">
            <h1 style="margin:0;font-size:22px;color:#E30613;">Invoice ${safeInvoiceNo}</h1>
            <p style="margin:4px 0 0 0;font-size:12px;color:#6b7280;">Alwaan L.L.C.</p>
          </div>
          <p>Dear ${safeName},</p>
          <p>An invoice has been issued to you. Details below.</p>
          <table style="width:100%;border-collapse:collapse;margin:14px 0;">
            <tr style="background:#fafafa;"><td style="padding:8px 12px;font-size:12px;color:#6b7280;width:40%;border-bottom:1px solid #e5e7eb;">Invoice #</td><td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #e5e7eb;font-family:monospace;">${safeInvoiceNo}</td></tr>
            <tr><td style="padding:8px 12px;font-size:12px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Type</td><td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #e5e7eb;">${(invoice.type || '—').replace(/[<>]/g, '')}</td></tr>
            ${invoice.unit?.unitNo ? `<tr style="background:#fafafa;"><td style="padding:8px 12px;font-size:12px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Unit</td><td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #e5e7eb;">${invoice.unit.unitNo}</td></tr>` : ''}
            <tr><td style="padding:8px 12px;font-size:12px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Amount</td><td style="padding:8px 12px;font-size:14px;border-bottom:1px solid #e5e7eb;font-weight:700;color:#E30613;">${aed(invoice.totalAmount)}</td></tr>
            <tr style="background:#fafafa;"><td style="padding:8px 12px;font-size:12px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Due Date</td><td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #e5e7eb;font-weight:600;">${(invoice.dueDate || '—').replace(/[<>]/g, '')}</td></tr>
          </table>
          <div style="margin:18px 0;padding:14px;background:#fff5f5;border-left:4px solid #E30613;border-radius:4px;font-size:13px;">
            <strong>How to pay:</strong>
            <ol style="margin:6px 0 0 18px;padding:0;">
              <li>Pay via bank transfer or in-person at our office.</li>
              <li>Log in to your tenant portal and upload your payment receipt as proof.</li>
            </ol>
          </div>
          <p style="text-align:center;margin:18px 0;">
            <a href="${portalUrl}" style="display:inline-block;background:#E30613;color:#fff;padding:10px 22px;border-radius:6px;text-decoration:none;font-weight:600;font-size:13px;">Open Tenant Portal</a>
          </p>
          <p style="margin:14px 0 0 0;font-size:11px;color:#6b7280;">For any queries: <a href="mailto:info@cre.ae" style="color:#E30613;">info@cre.ae</a></p>
        </div>
      </body></html>`

      const r = await sendEmail({
        organizationId,
        to: invoice.tenant.email,
        toName: invoice.tenant.name,
        subject: `Invoice ${safeInvoiceNo} — ${aed(invoice.totalAmount)} due ${invoice.dueDate}`,
        html,
        template: 'invoice_sent',
        triggeredBy: session.user.name,
        refType: 'invoice',
        refId: invoice.id,
      })
      emailSent = r.success
      emailError = r.error || null
    }

    await logActivity(
      organizationId,
      session.user.name,
      'Sent Invoice',
      `Invoice ${invoice.invoiceNo} sent to ${invoice.tenant?.name || 'tenant'}${emailSent ? ' (email delivered)' : invoice.tenant?.email ? ' (email failed)' : ' (no email on file)'}`
    )

    return NextResponse.json({
      ...updated,
      emailSent,
      emailError,
    })
  } catch (error) {
    console.error('POST /api/invoices/[id]/send error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
