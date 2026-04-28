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
      field: 'proof' | 'dewaClearance' | 'fmrReport',
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
      // Two new mandatory docs per spec; the legacy "proof" stays optional.
      await saveDoc('dewaClearance', 'DEWA Clearance', true)
      await saveDoc('fmrReport', 'FMR Report', true)
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
    const reasonWithMeta = `[${typeLabel}] ${reason}\n${datesLine}`
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
      const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#111;background:#f4f5f7;margin:0;padding:0;">
        <div style="max-width:560px;margin:24px auto;padding:32px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;">
          <div style="height:4px;width:48px;background:#E30613;border-radius:2px;margin-bottom:20px;"></div>
          <h1 style="margin:0 0 14px 0;font-size:20px;">Tenancy Contract Terminated</h1>
          <p>Dear ${tenant.name},</p>
          <p>Your tenancy contract with Alwaan has been terminated${effectiveDate ? ` effective <strong>${effectiveDate}</strong>` : ''}.</p>
          <p style="margin:16px 0;padding:12px;background:#fff5f5;border-left:4px solid #E30613;border-radius:4px;"><strong>Reason:</strong><br/>${reason.replace(/[<>]/g, '')}</p>
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
