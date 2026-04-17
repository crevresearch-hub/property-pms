import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { hash } from 'bcryptjs'
import crypto from 'crypto'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { createNotification } from '@/lib/notifications'
import { sendEmail } from '@/lib/email'

// Cheque *scans* are optional; the mandatory items for activation are
// Emirates ID, Ejari, and a declared number-of-cheques >= 1 (which seeds
// empty Cheque records below).
const REQUIRED_DOCS = ['Emirates ID', 'Ejari'] as const

function randomPassword(length = 10): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const bytes = crypto.randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length]
  return out
}

/**
 * POST /api/tenants/[id]/activate
 *
 * Validates pre-conditions:
 *   - Tenant has a signed tenancy contract (signedByTenantAt set, OR signedFilePath uploaded)
 *   - All 3 mandatory documents uploaded: Emirates ID, Ejari, Cheques
 *
 * Then:
 *   - Generates a random password and bcrypt-hashes it onto tenant.passwordHash
 *   - Sets tenant.status = 'Active'
 *   - Emails tenant their credentials + contract link
 *   - Returns the plaintext password (shown once to staff)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const organizationId = session.user.organizationId
    const { id } = await params

    // ---- Parse optional body { numCheques } ----
    let numChequesInput = 0
    try {
      const body = await request.json().catch(() => null)
      if (body && typeof body.numCheques === 'number' && Number.isFinite(body.numCheques)) {
        numChequesInput = Math.floor(body.numCheques)
      }
    } catch {
      // ignore — body is optional
    }
    if (numChequesInput < 1 || numChequesInput > 12) {
      return NextResponse.json(
        { error: 'numCheques is required and must be between 1 and 12.' },
        { status: 400 }
      )
    }

    const tenant = await prisma.tenant.findFirst({
      where: { id, organizationId },
    })
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    if (!tenant.email) {
      return NextResponse.json(
        { error: 'Tenant needs an email on file before activation.' },
        { status: 400 }
      )
    }

    // ---- 1. Verify a signed tenancy contract exists ----
    const signedContract = await prisma.tenancyContract.findFirst({
      where: {
        organizationId,
        tenantId: id,
        OR: [
          { signedByTenantAt: { not: null } },
          { signedFilePath: { not: '' } },
          { status: 'Active' },
        ],
      },
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
    })
    if (!signedContract) {
      return NextResponse.json(
        { error: 'Tenant has not signed the tenancy contract yet.' },
        { status: 400 }
      )
    }

    // ---- 2. Verify all 3 mandatory documents uploaded ----
    const docs = await prisma.tenantDocument.findMany({
      where: { organizationId, tenantId: id, docType: { in: [...REQUIRED_DOCS] } },
      select: { docType: true },
    })
    const uploadedTypes = new Set(docs.map((d) => d.docType))
    const missing = REQUIRED_DOCS.filter((t) => !uploadedTypes.has(t))
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing mandatory documents: ${missing.join(', ')}` },
        { status: 400 }
      )
    }

    // ---- 3. Generate + hash password ----
    const newPassword = randomPassword(10)
    const passwordHash = await hash(newPassword, 10)

    const updated = await prisma.tenant.update({
      where: { id },
      data: {
        passwordHash,
        status: 'Active',
      },
    })

    // ---- Seed empty Cheque records so the cheque tracker is pre-populated.
    // We only create them if the tenant has no cheques yet (re-activation safety).
    const existingChequeCount = await prisma.cheque.count({
      where: { organizationId, tenantId: id },
    })
    let chequesCreated = 0
    if (existingChequeCount === 0 && numChequesInput > 0) {
      const primaryUnitId =
        (await prisma.unit.findFirst({
          where: { organizationId, tenantId: id },
          select: { id: true },
        }))?.id ?? null

      const perCheque = signedContract.rentAmount
        ? Math.round((signedContract.rentAmount / numChequesInput) * 100) / 100
        : 0

      const rows = Array.from({ length: numChequesInput }, (_, i) => ({
        organizationId,
        tenantId: id,
        unitId: primaryUnitId,
        sequenceNo: i + 1,
        totalCheques: numChequesInput,
        status: 'Pending',
        paymentType: 'Rent',
        amount: perCheque,
        chequeNo: '',
        chequeDate: '',
        bankName: '',
      }))
      const created = await prisma.cheque.createMany({ data: rows })
      chequesCreated = created.count
    }

    // ---- 4. Send welcome email ----
    const baseUrl = (process.env.NEXTAUTH_URL || '').replace(/\/$/, '')
    const loginUrl = `${baseUrl}/tenant/login`
    const contractUrl = `${baseUrl}/api/tenancy-contracts/${signedContract.id}?format=html`

    // Pull the tenant's cheque schedule (post-activation) + upfront breakdown
    // so the welcome email shows a complete payment summary.
    const allCheques = await prisma.cheque.findMany({
      where: { organizationId, tenantId: id },
      orderBy: { sequenceNo: 'asc' },
    })
    const UPFRONT_PREFIX = 'UPFRONT_JSON:'
    let upfront = {
      cash: 0,
      chequeAmount: 0,
      chequeNo: '',
      bankName: '',
      chequeDate: '',
      receiptNo: '',
      receiptSentAt: '',
    }
    for (const line of (signedContract.notes || '').split('\n')) {
      if (line.startsWith(UPFRONT_PREFIX)) {
        try { upfront = { ...upfront, ...JSON.parse(line.slice(UPFRONT_PREFIX.length)) } } catch { /* ignore */ }
      }
    }
    const upfrontTotal = upfront.cash + upfront.chequeAmount
    const aedFmt = (n: number) => `AED ${Number(n || 0).toLocaleString()}`

    // Pull tenant documents so we can include cheque images + Ejari + EID links
    // directly in the welcome email.
    const tenantDocs = await prisma.tenantDocument.findMany({
      where: { organizationId, tenantId: id },
    })
    const docLink = (d: { id: string; originalFilename: string | null; filename: string }) =>
      `${baseUrl}/api/documents/${d.id}/file`
    const ejariDoc = tenantDocs.find((d) => d.docType === 'Ejari')
    const eidFront = tenantDocs.find((d) => d.docType === 'Emirates ID')
    const eidBack = tenantDocs.find((d) => d.docType === 'Emirates ID (Back)')
    const upfrontChequeImg = tenantDocs.find((d) => d.docType === 'Upfront-Cheque')
    const chequeImageByType = (seq: number) =>
      tenantDocs.find((d) => d.docType === `Cheque-${seq}`)

    const chequeRowsHtml = allCheques.map((c) => {
      const isUpfront = c.sequenceNo === 1 && c.paymentType === 'Upfront'
      const status = c.status || 'Pending'
      const statusBadge =
        status === 'Cleared'
          ? '<span style="background:#d1fae5;color:#065f46;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;">CLEARED</span>'
          : status === 'Bounced'
          ? '<span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;">BOUNCED</span>'
          : status === 'Deposited'
          ? '<span style="background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;">DEPOSITED</span>'
          : '<span style="background:#f3f4f6;color:#374151;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;">UPCOMING</span>'
      const img = isUpfront ? upfrontChequeImg : chequeImageByType(c.sequenceNo)
      const imgCell = img
        ? `<a href="${docLink(img)}" style="color:#E30613;text-decoration:none;">View ↗</a>`
        : '—'
      return `<tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:6px 10px;font-size:11px;">${isUpfront ? `<strong>Cheque ${c.sequenceNo}</strong> <span style='color:#1e40af;font-size:10px;'>(Upfront)</span>` : `Cheque ${c.sequenceNo}`}</td>
        <td style="padding:6px 10px;font-size:11px;font-family:monospace;">${escapeHtml(c.chequeNo || '—')}</td>
        <td style="padding:6px 10px;font-size:11px;">${escapeHtml(c.bankName || '—')}</td>
        <td style="padding:6px 10px;font-size:11px;">${escapeHtml(c.chequeDate || '—')}</td>
        <td style="padding:6px 10px;font-size:11px;text-align:right;font-weight:600;">${aedFmt(c.amount)}</td>
        <td style="padding:6px 10px;font-size:11px;">${statusBadge}</td>
        <td style="padding:6px 10px;font-size:11px;">${imgCell}</td>
      </tr>`
    }).join('')

    const upfrontBlockHtml = upfrontTotal > 0
      ? `<div style="margin:18px 0;padding:14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <p style="margin:0;font-size:12px;font-weight:700;color:#1e40af;">Upfront Payment Receipt</p>
            ${upfront.receiptNo ? `<span style="font-family:monospace;font-size:11px;color:#1e40af;">${escapeHtml(upfront.receiptNo)}</span>` : ''}
          </div>
          <table style="width:100%;font-size:12px;">
            ${upfront.cash > 0 ? `<tr><td style="padding:2px 0;color:#1e3a8a;">Cash</td><td style="padding:2px 0;text-align:right;font-weight:600;">${aedFmt(upfront.cash)}</td></tr>` : ''}
            ${upfront.chequeAmount > 0 ? `<tr><td style="padding:2px 0;color:#1e3a8a;">Cheque ${escapeHtml(upfront.chequeNo)} (${escapeHtml(upfront.bankName)})</td><td style="padding:2px 0;text-align:right;font-weight:600;">${aedFmt(upfront.chequeAmount)}</td></tr>` : ''}
            <tr style="border-top:1px solid #bfdbfe;"><td style="padding:4px 0;color:#1e3a8a;font-weight:700;">Total Upfront</td><td style="padding:4px 0;text-align:right;font-weight:700;color:#1e3a8a;">${aedFmt(upfrontTotal)}</td></tr>
          </table>
        </div>`
      : ''

    const docsBlockHtml = (ejariDoc || eidFront || eidBack) ? `
      <h3 style="margin:18px 0 6px 0;font-size:14px;color:#111;">Your Documents</h3>
      <table style="width:100%;border-collapse:collapse;font-size:12px;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
        ${ejariDoc ? `<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:6px 10px;color:#6b7280;">Ejari Registration</td><td style="padding:6px 10px;text-align:right;"><a href="${docLink(ejariDoc)}" style="color:#E30613;">View ↗</a></td></tr>` : ''}
        ${eidFront ? `<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:6px 10px;color:#6b7280;">Emirates ID — Front</td><td style="padding:6px 10px;text-align:right;"><a href="${docLink(eidFront)}" style="color:#E30613;">View ↗</a></td></tr>` : ''}
        ${eidBack ? `<tr><td style="padding:6px 10px;color:#6b7280;">Emirates ID — Back</td><td style="padding:6px 10px;text-align:right;"><a href="${docLink(eidBack)}" style="color:#E30613;">View ↗</a></td></tr>` : ''}
      </table>` : ''

    const chequeScheduleHtml = allCheques.length > 0
      ? `<h3 style="margin:18px 0 6px 0;font-size:14px;color:#111;">Your Cheque Schedule</h3>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:6px 10px;text-align:left;font-size:10px;color:#6b7280;text-transform:uppercase;">#</th>
              <th style="padding:6px 10px;text-align:left;font-size:10px;color:#6b7280;text-transform:uppercase;">Cheque No.</th>
              <th style="padding:6px 10px;text-align:left;font-size:10px;color:#6b7280;text-transform:uppercase;">Bank</th>
              <th style="padding:6px 10px;text-align:left;font-size:10px;color:#6b7280;text-transform:uppercase;">Date</th>
              <th style="padding:6px 10px;text-align:right;font-size:10px;color:#6b7280;text-transform:uppercase;">Amount</th>
              <th style="padding:6px 10px;text-align:left;font-size:10px;color:#6b7280;text-transform:uppercase;">Status</th>
              <th style="padding:6px 10px;text-align:left;font-size:10px;color:#6b7280;text-transform:uppercase;">Image</th>
            </tr>
          </thead>
          <tbody>${chequeRowsHtml}</tbody>
        </table>`
      : ''

    const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#111;">
  <div style="max-width:600px;margin:24px auto;padding:32px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;">
    <div style="height:4px;width:60px;background:#E30613;border-radius:2px;margin-bottom:20px;"></div>
    <h1 style="margin:0 0 12px 0;font-size:24px;color:#0b3d2e;">Congratulations, ${escapeHtml(tenant.name)}!</h1>
    <p style="margin:0 0 12px 0;font-size:15px;">Welcome to <strong>Alwaan</strong>.</p>
    <p style="margin:0 0 14px 0;">Your tenancy is now <strong style="color:#059669;">Active</strong>. You can now log in to your tenant portal to view your contract, pay rent, submit maintenance requests, and manage your account.</p>

    <table style="width:100%;margin:18px 0;border:1px solid #e5e7eb;border-radius:6px;background:#fafafa;border-collapse:separate;border-spacing:0;">
      <tr><td style="padding:10px 12px;font-size:12px;color:#6b7280;width:40%;">Login URL</td>
          <td style="padding:10px 12px;font-size:13px;font-weight:600;">
            <a href="${loginUrl}" style="color:#E30613;text-decoration:none;">${loginUrl}</a></td></tr>
      <tr><td style="padding:10px 12px;font-size:12px;color:#6b7280;">Username (email)</td>
          <td style="padding:10px 12px;font-size:13px;font-weight:600;">${escapeHtml(tenant.email)}</td></tr>
      <tr><td style="padding:10px 12px;font-size:12px;color:#6b7280;">Temporary Password</td>
          <td style="padding:10px 12px;font-size:15px;font-weight:700;font-family:monospace;letter-spacing:0.5px;">${newPassword}</td></tr>
    </table>

    <div style="margin:18px 0;padding:14px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:6px;">
      <p style="margin:0 0 6px 0;font-size:13px;font-weight:600;color:#065f46;">Signed Tenancy Contract</p>
      <p style="margin:4px 0 0 0;font-size:12.5px;color:#065f46;">
        <a href="${contractUrl}" style="color:#065f46;font-weight:600;">View ${escapeHtml(signedContract.contractNo)} ↗</a>
      </p>
    </div>

    ${docsBlockHtml}

    ${upfrontBlockHtml}

    ${chequeScheduleHtml}

    <p style="margin:14px 0 0 0;font-size:12px;color:#6b7280;">
      For your security, please change your password after your first login.
      If you have any questions, contact our property management team.
    </p>
  </div>
</body></html>`

    const emailResult = await sendEmail({
      organizationId,
      to: tenant.email,
      toName: tenant.name,
      subject: 'Welcome to Alwaan — Your Tenancy is Active',
      html,
      template: 'tenant_activated_welcome',
      triggeredBy: session.user.name,
      refType: 'tenant',
      refId: tenant.id,
    })

    await logActivity(
      organizationId,
      session.user.name,
      'Activated Tenant',
      `Tenant ${tenant.name} activated; portal credentials emailed to ${tenant.email}${
        chequesCreated > 0 ? `; ${chequesCreated} cheque(s) seeded` : ''
      }`
    )

    await createNotification(
      organizationId,
      'staff',
      '',
      'Tenant Activated',
      `${tenant.name} is now active and has portal access.`,
      'system'
    )

    return NextResponse.json({
      message: 'Tenant activated',
      password: newPassword,
      chequesCreated,
      emailSent: emailResult.success,
      emailError: emailResult.error || null,
      tenant: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        status: updated.status,
      },
    })
  } catch (error) {
    console.error('POST /api/tenants/[id]/activate error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
