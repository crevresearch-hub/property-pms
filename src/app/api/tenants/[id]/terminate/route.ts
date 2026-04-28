import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { createNotification } from '@/lib/notifications'
import { sendEmail } from '@/lib/email'

export const runtime = 'nodejs'

const ALLOWED = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
const MAX_BYTES = 10 * 1024 * 1024

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const organizationId = session.user.organizationId
    const { id } = await params

    const tenant = await prisma.tenant.findFirst({ where: { id, organizationId } })
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const form = await request.formData()
    const reason = String(form.get('reason') || '').trim()
    const effectiveDate = String(form.get('effectiveDate') || '').trim()
    const terminationType = String(form.get('terminationType') || '').trim()  // BreakLease | NonRenewal
    const dewaClosingDate = String(form.get('dewaClosingDate') || '').trim()
    const rentCalcDate = String(form.get('rentCalcDate') || '').trim()
    // Settlement snapshot captured at the moment of termination.
    const annualRent = parseFloat(String(form.get('annualRent') || '0')) || 0
    const securityDeposit = parseFloat(String(form.get('securityDeposit') || '0')) || 0
    const rentReceived = parseFloat(String(form.get('rentReceived') || '0')) || 0
    const maintenanceCharges = parseFloat(String(form.get('maintenanceCharges') || '0')) || 0
    const otherCharges = parseFloat(String(form.get('otherCharges') || '0')) || 0
    const otherCredits = parseFloat(String(form.get('otherCredits') || '0')) || 0
    if (reason.length < 3) {
      return NextResponse.json({ error: 'Termination reason is required.' }, { status: 400 })
    }
    if (!['BreakLease', 'NonRenewal'].includes(terminationType)) {
      return NextResponse.json({ error: 'terminationType must be BreakLease or NonRenewal.' }, { status: 400 })
    }
    if (!dewaClosingDate) return NextResponse.json({ error: 'DEWA closing date is required.' }, { status: 400 })
    if (!rentCalcDate) return NextResponse.json({ error: 'Rent calculation date is required.' }, { status: 400 })

    // Helper: validate + persist a single uploaded file as a TenantDocument.
    // Returns the relative path on success (or '' if no file was provided).
    const saveDoc = async (
      field: 'proof' | 'dewaClearance' | 'fmrReport' | 'aquaCool',
      docType: string,
      required: boolean
    ): Promise<string> => {
      const file = form.get(field)
      if (!(file instanceof File) || file.size === 0) {
        if (required) throw new Error(`${docType} is required.`)
        return ''
      }
      const mime = (file.type || '').toLowerCase()
      if (!ALLOWED.has(mime)) throw new Error(`${docType} must be PDF, JPG, PNG or WebP.`)
      if (file.size > MAX_BYTES) throw new Error(`${docType} must be 10 MB or smaller.`)
      const buf = Buffer.from(await file.arrayBuffer())
      const ext = mime.split('/')[1].replace('jpeg', 'jpg')
      const fileName = `${field}-${Date.now()}.${ext}`
      const dir = path.join(process.cwd(), 'uploads', 'terminations', tenant.id)
      await mkdir(dir, { recursive: true }).catch(() => {})
      await writeFile(path.join(dir, fileName), buf).catch(() => {})
      const rel = `uploads/terminations/${tenant.id}/${fileName}`
      await prisma.tenantDocument.create({
        data: {
          organizationId,
          tenantId: tenant.id,
          docType,
          filename: fileName,
          originalFilename: file.name || fileName,
          filePath: rel,
          fileSize: buf.length,
          status: 'Uploaded',
          reviewNotes: `Uploaded at termination (${terminationType}): ${reason.slice(0, 180)}`,
        },
      })
      return rel
    }

    let proofRelPath = ''
    try {
      // Three mandatory docs per spec; the legacy "proof" stays optional.
      await saveDoc('dewaClearance', 'DEWA Clearance', true)
      await saveDoc('fmrReport', 'FMR Report', true)
      await saveDoc('aquaCool', 'Aqua Cool Clearance', true)
      proofRelPath = await saveDoc('proof', 'Termination Proof', false)
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'File upload failed' }, { status: 400 })
    }

    const now = new Date()
    // Bake the type + DEWA / rent-calc dates into the human-readable reason
    // so they show up everywhere the reason is rendered, AND we don't need
    // a schema change to track them.
    const typeLabel = terminationType === 'BreakLease' ? 'Break Lease' : 'Non Renewal'
    const datesLine = `DEWA closing: ${dewaClosingDate} · Rent calc: ${rentCalcDate}`
    // Settlement: same calculation as the modal preview, so the snapshot
    // stored with the record matches what staff approved.
    const monthlyRent = annualRent / 12
    const start = new Date()
    const tcActive = await prisma.tenancyContract.findFirst({
      where: { organizationId, tenantId: tenant.id, status: 'Active' },
      select: { contractStart: true, securityDeposit: true },
    })
    if (tcActive?.contractStart) {
      const d = new Date(tcActive.contractStart)
      if (!Number.isNaN(d.getTime())) start.setTime(d.getTime())
    }
    const end = new Date(rentCalcDate || dewaClosingDate)
    const monthsDue = Math.max(
      0,
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth()) +
      (end.getDate() >= start.getDate() ? 0 : -1)
    )
    const rentDue = monthlyRent * monthsDue
    const penalty = terminationType === 'BreakLease' ? monthlyRent * 2 : 0
    const totalCharges = rentDue + maintenanceCharges + otherCharges + penalty
    const totalCredits = rentReceived + securityDeposit + otherCredits
    const net = totalCredits - totalCharges  // > 0 → refund tenant; < 0 → tenant owes
    const settleLine = `Settlement: rent due ${Math.round(rentDue).toLocaleString()} (${monthsDue}m × ${Math.round(monthlyRent).toLocaleString()})${penalty > 0 ? ` + penalty ${Math.round(penalty).toLocaleString()}` : ''}${maintenanceCharges > 0 ? ` + maint ${Math.round(maintenanceCharges).toLocaleString()}` : ''}${otherCharges > 0 ? ` + other ${Math.round(otherCharges).toLocaleString()}` : ''} − received ${Math.round(rentReceived).toLocaleString()} − deposit ${Math.round(securityDeposit).toLocaleString()}${otherCredits > 0 ? ` − other-cr ${Math.round(otherCredits).toLocaleString()}` : ''} = ${net >= 0 ? 'refund' : 'tenant-owes'} AED ${Math.round(Math.abs(net)).toLocaleString()}`
    const reasonWithMeta = `[${typeLabel}] ${reason}\n${datesLine}\n${settleLine}`
    await prisma.tenancyContract.updateMany({
      where: { organizationId, tenantId: tenant.id, status: 'Active' },
      data: {
        status: 'Terminated',
        terminatedAt: now,
        terminationReason: reasonWithMeta,
      },
    })

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        status: 'Terminated',
        passwordHash: '',
        notes: [
          tenant.notes || '',
          `Contract terminated on ${now.toISOString().slice(0, 10)}${effectiveDate ? ` (effective ${effectiveDate})` : ''} — ${typeLabel} · ${datesLine} — ${reason}`,
        ].filter(Boolean).join('\n'),
      },
    })

    await logActivity(
      organizationId,
      session.user.name,
      'Terminated Tenancy Contract',
      `Tenant ${tenant.name} terminated — ${reason.slice(0, 120)}`
    )
    await createNotification(
      organizationId,
      'staff',
      '',
      'Tenancy Contract Terminated',
      `${tenant.name} — ${reason.slice(0, 120)}`,
      'system'
    )

    if (tenant.email) {
      // Inline-styled HTML — must work in Gmail/Outlook without external CSS.
      const safeReason = reason.replace(/[<>]/g, '')
      const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#111;background:#f4f5f7;margin:0;padding:0;">
        <div style="max-width:600px;margin:24px auto;padding:32px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;">
          <div style="height:4px;width:48px;background:#E30613;border-radius:2px;margin-bottom:20px;"></div>
          <h1 style="margin:0 0 14px 0;font-size:20px;">Tenancy Contract Terminated</h1>
          <p>Dear ${tenant.name.replace(/[<>]/g, '')},</p>
          <p>Your tenancy contract with Alwaan has been terminated${effectiveDate ? ` effective <strong>${effectiveDate}</strong>` : ''}.</p>

          <table style="width:100%;border-collapse:collapse;margin:16px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
            <tr style="background:#fafafa;">
              <td style="padding:10px 14px;font-size:12px;color:#666;width:170px;">Termination type</td>
              <td style="padding:10px 14px;font-size:13px;color:#111;"><strong>${typeLabel}</strong>${terminationType === 'BreakLease' ? ' <span style="color:#92400e;">(2-month penalty applies)</span>' : ''}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;font-size:12px;color:#666;border-top:1px solid #e5e7eb;">DEWA closing date</td>
              <td style="padding:10px 14px;font-size:13px;color:#111;border-top:1px solid #e5e7eb;">${dewaClosingDate}</td>
            </tr>
            <tr style="background:#fafafa;">
              <td style="padding:10px 14px;font-size:12px;color:#666;border-top:1px solid #e5e7eb;">Rent calculation date</td>
              <td style="padding:10px 14px;font-size:13px;color:#111;border-top:1px solid #e5e7eb;">${rentCalcDate}</td>
            </tr>
          </table>

          <p style="margin:16px 0;padding:12px;background:#fff5f5;border-left:4px solid #E30613;border-radius:4px;"><strong>Reason:</strong><br/>${safeReason}</p>

          <h3 style="margin:18px 0 8px 0;font-size:14px;color:#222;">Final Settlement</h3>
          <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;font-size:12px;">
            <tr style="background:#fafafa;"><td style="padding:8px 12px;color:#666;">Rent due (${monthsDue} month${monthsDue === 1 ? '' : 's'} × AED ${Math.round(monthlyRent).toLocaleString()})</td><td style="padding:8px 12px;text-align:right;color:#a00;">AED ${Math.round(rentDue).toLocaleString()}</td></tr>
            ${penalty > 0 ? `<tr><td style="padding:8px 12px;color:#92400e;border-top:1px solid #e5e7eb;">Break Lease penalty (2 months)</td><td style="padding:8px 12px;text-align:right;color:#92400e;border-top:1px solid #e5e7eb;font-weight:600;">AED ${Math.round(penalty).toLocaleString()}</td></tr>` : ''}
            ${maintenanceCharges > 0 ? `<tr style="background:#fafafa;"><td style="padding:8px 12px;color:#666;border-top:1px solid #e5e7eb;">Maintenance charges</td><td style="padding:8px 12px;text-align:right;color:#a00;border-top:1px solid #e5e7eb;">AED ${Math.round(maintenanceCharges).toLocaleString()}</td></tr>` : ''}
            ${otherCharges > 0 ? `<tr><td style="padding:8px 12px;color:#666;border-top:1px solid #e5e7eb;">Other charges</td><td style="padding:8px 12px;text-align:right;color:#a00;border-top:1px solid #e5e7eb;">AED ${Math.round(otherCharges).toLocaleString()}</td></tr>` : ''}
            <tr style="background:#fafafa;"><td style="padding:8px 12px;color:#666;border-top:1px solid #e5e7eb;">Rent received so far</td><td style="padding:8px 12px;text-align:right;color:#067647;border-top:1px solid #e5e7eb;">− AED ${Math.round(rentReceived).toLocaleString()}</td></tr>
            <tr><td style="padding:8px 12px;color:#666;border-top:1px solid #e5e7eb;">Security deposit refund</td><td style="padding:8px 12px;text-align:right;color:#067647;border-top:1px solid #e5e7eb;">− AED ${Math.round(securityDeposit).toLocaleString()}</td></tr>
            ${otherCredits > 0 ? `<tr style="background:#fafafa;"><td style="padding:8px 12px;color:#666;border-top:1px solid #e5e7eb;">Other credits</td><td style="padding:8px 12px;text-align:right;color:#067647;border-top:1px solid #e5e7eb;">− AED ${Math.round(otherCredits).toLocaleString()}</td></tr>` : ''}
            <tr style="background:${net > 0 ? '#ecfdf5' : net < 0 ? '#fef2f2' : '#f3f4f6'};">
              <td style="padding:10px 12px;border-top:2px solid #cbd5e1;font-weight:700;color:#111;">${net > 0 ? 'Refund due to tenant' : net < 0 ? 'Tenant owes' : 'Settled'}</td>
              <td style="padding:10px 12px;border-top:2px solid #cbd5e1;text-align:right;font-weight:700;color:${net > 0 ? '#067647' : net < 0 ? '#a00' : '#111'};">AED ${Math.round(Math.abs(net)).toLocaleString()}</td>
            </tr>
          </table>

          <p>Your tenant portal access has been disabled. For any questions, please contact <a href="mailto:info@alwaan.ae" style="color:#E30613;">info@alwaan.ae</a>.</p>
        </div>
      </body></html>`
      await sendEmail({
        organizationId,
        to: tenant.email,
        toName: tenant.name,
        subject: 'Tenancy Contract Terminated',
        html,
        template: 'tenancy_terminated',
        triggeredBy: session.user.name,
        refType: 'tenant',
        refId: tenant.id,
      }).catch((e) => console.warn('Termination email failed:', e))
    }

    return NextResponse.json({ message: 'Tenancy contract terminated', proofPath: proofRelPath })
  } catch (error) {
    console.error('POST /api/tenants/[id]/terminate error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
