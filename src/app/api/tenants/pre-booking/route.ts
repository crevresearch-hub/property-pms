import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { sendEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const organizationId = session.user.organizationId
    const body = await request.json()
    const {
      name,
      phone,
      email,
      unitId,
      usage,
      expectedMoveIn,
      preBookingDeposit,
      notes,
    } = body

    const baseDeposit = parseFloat(preBookingDeposit) || 0
    const isCommercial = usage === 'Commercial'
    const vat = isCommercial ? +(baseDeposit * 0.05).toFixed(2) : 0
    const totalDeposit = +(baseDeposit + vat).toFixed(2)

    if (!name?.trim() || !phone?.trim()) {
      return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 })
    }

    // Validate unit if provided
    let unit = null
    if (unitId) {
      unit = await prisma.unit.findFirst({ where: { id: unitId, organizationId } })
      if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
    }

    const combinedNotes = [
      `Usage: ${usage || 'Residential'}`,
      isCommercial && `Base deposit: AED ${baseDeposit}`,
      isCommercial && `VAT (5%): AED ${vat}`,
      isCommercial && `Total deposit (incl. VAT): AED ${totalDeposit}`,
      notes,
    ].filter(Boolean).join('\n')

    const tenant = await prisma.tenant.create({
      data: {
        organizationId,
        name: name.trim(),
        phone: phone.trim(),
        email: email?.trim() || '',
        status: 'Pre-Booked',
        preBookingDeposit: totalDeposit,  // stores total including VAT for commercial
        preBookingDate: new Date().toISOString().slice(0, 10),
        expectedMoveIn: expectedMoveIn || '',
        notes: combinedNotes,
      },
    })

    // Note: we do NOT change Unit.tenantId yet — the current tenant (if any) still occupies it.
    // We link via notes or a separate reservation concept.
    if (unit) {
      const reservationNote = `Pre-Booked: ${name} (${phone}) — ${usage || 'Residential'} — expects move-in ${expectedMoveIn || 'TBD'} — deposit AED ${totalDeposit}${isCommercial ? ' (incl. 5% VAT)' : ''}`
      await prisma.unit.update({
        where: { id: unit.id },
        data: {
          notes: unit.notes ? `${unit.notes}\n${reservationNote}` : reservationNote,
        },
      })
    }

    await logActivity(
      organizationId,
      session.user.name,
      'Pre-Booking Created',
      `${name} pre-booked${unit ? ` unit ${unit.unitNo}` : ''} — ${usage || 'Residential'} — deposit AED ${totalDeposit}${isCommercial ? ` (base ${baseDeposit} + VAT ${vat})` : ''}`
    )

    // Send receipt email to tenant (if email provided)
    let emailResult: { success: boolean; error?: string } = { success: false, error: 'No email provided' }
    if (email?.trim()) {
      const today = new Date().toISOString().slice(0, 10)
      const receiptNo = `PB-${Date.now().toString().slice(-8)}`
      const fmt = (n: number) => `AED ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

      const html = `<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f5f5f5;margin:0;padding:0">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.08)">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#E30613,#a20410);color:#fff;padding:32px 32px 24px">
      <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:3px;opacity:0.85">ALWAAN PROPERTY MANAGEMENT</p>
      <h1 style="margin:8px 0 4px;font-size:24px;font-weight:800">Pre-Booking Receipt</h1>
      <p style="margin:0;opacity:0.9;font-size:14px">Thank you, ${name}!</p>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px">
      <p style="margin:0 0 16px;color:#333;font-size:14px;line-height:1.6">
        We've received your pre-booking. Your deposit secures the unit until your scheduled move-in date.
      </p>

      <!-- Receipt box -->
      <div style="background:#fafafa;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:20px 0">
        <table style="width:100%;font-size:13px;color:#333">
          <tr><td style="padding:6px 0;color:#666">Receipt No:</td><td style="padding:6px 0;text-align:right;font-family:monospace">${receiptNo}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Date:</td><td style="padding:6px 0;text-align:right">${today}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Tenant:</td><td style="padding:6px 0;text-align:right">${name}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Phone:</td><td style="padding:6px 0;text-align:right">${phone}</td></tr>
          ${unit ? `<tr><td style="padding:6px 0;color:#666">Unit:</td><td style="padding:6px 0;text-align:right;font-weight:600">${unit.unitNo}</td></tr>` : ''}
          <tr><td style="padding:6px 0;color:#666">Property Type:</td><td style="padding:6px 0;text-align:right">${usage}</td></tr>
          ${expectedMoveIn ? `<tr><td style="padding:6px 0;color:#666">Expected Move-In:</td><td style="padding:6px 0;text-align:right">${expectedMoveIn}</td></tr>` : ''}
        </table>
      </div>

      <!-- Amount -->
      <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:20px;margin:20px 0">
        <p style="margin:0 0 12px;font-size:11px;color:#92400e;font-weight:700;letter-spacing:2px;text-transform:uppercase">Payment Received</p>
        <table style="width:100%;font-size:13px">
          ${isCommercial ? `
          <tr><td style="padding:4px 0;color:#78350f">Base Deposit:</td><td style="padding:4px 0;text-align:right;font-family:monospace">${fmt(baseDeposit)}</td></tr>
          <tr><td style="padding:4px 0;color:#78350f">VAT (5%):</td><td style="padding:4px 0;text-align:right;font-family:monospace">${fmt(vat)}</td></tr>
          <tr><td colspan="2" style="border-top:2px solid #fcd34d;padding:0;height:1px"></td></tr>
          <tr><td style="padding:8px 0 0;color:#92400e;font-weight:700;font-size:15px">Total Paid:</td><td style="padding:8px 0 0;text-align:right;font-family:monospace;font-weight:700;font-size:16px;color:#92400e">${fmt(totalDeposit)}</td></tr>
          ` : `
          <tr><td style="padding:4px 0;color:#92400e;font-weight:700;font-size:15px">Deposit Paid:</td><td style="padding:4px 0;text-align:right;font-family:monospace;font-weight:700;font-size:16px;color:#92400e">${fmt(totalDeposit)}</td></tr>
          `}
        </table>
      </div>

      <!-- Next steps -->
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin:20px 0">
        <p style="margin:0 0 6px;font-weight:600;color:#1e40af;font-size:13px">📋 Next Steps</p>
        <ol style="margin:0;padding-left:20px;color:#1e3a8a;font-size:12px;line-height:1.7">
          <li>We'll contact you before your move-in date to finalize the contract</li>
          <li>Please bring your original Emirates ID and passport on move-in day</li>
          <li>Remaining rent will be arranged via post-dated cheques or agreed payment plan</li>
          <li>Ejari registration happens after move-in</li>
        </ol>
      </div>

      ${notes ? `<div style="background:#f9fafb;border-left:3px solid #9ca3af;padding:12px 16px;margin:16px 0;font-size:12px;color:#4b5563"><strong>Notes:</strong> ${notes}</div>` : ''}

      <p style="margin:24px 0 0;color:#666;font-size:13px;line-height:1.6">
        If you have any questions, reply to this email or contact us directly.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#0a0a0a;color:#9ca3af;padding:20px 32px;text-align:center;font-size:11px">
      <p style="margin:0 0 4px;color:#fff;font-weight:700">Alwaan Property Management</p>
      <p style="margin:0;opacity:0.7">Dubai, United Arab Emirates · info@alwaan.ae</p>
      <p style="margin:8px 0 0;opacity:0.5;font-size:10px">This is an automated receipt. Please keep it for your records.</p>
    </div>
  </div>
</body></html>`

      emailResult = await sendEmail({
        organizationId,
        to: email.trim(),
        toName: name,
        subject: `Pre-Booking Confirmation — Receipt ${receiptNo}`,
        html,
        template: 'pre-booking-receipt',
        triggeredBy: session.user.name,
        refType: 'Tenant',
        refId: tenant.id,
      })
    }

    return NextResponse.json({
      tenant,
      unit: unit ? { id: unit.id, unitNo: unit.unitNo } : null,
      emailSent: emailResult.success,
      emailError: emailResult.error,
    }, { status: 201 })
  } catch (error) {
    console.error('POST /api/tenants/pre-booking error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
