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
    if (reason.length < 3) {
      return NextResponse.json({ error: 'Termination reason is required.' }, { status: 400 })
    }

    const proof = form.get('proof')
    let proofRelPath = ''
    if (proof instanceof File && proof.size > 0) {
      const mime = (proof.type || '').toLowerCase()
      if (!ALLOWED.has(mime)) {
        return NextResponse.json({ error: 'Proof must be PDF, JPG, PNG or WebP.' }, { status: 400 })
      }
      if (proof.size > MAX_BYTES) {
        return NextResponse.json({ error: 'Proof file must be 10 MB or smaller.' }, { status: 413 })
      }
      const buf = Buffer.from(await proof.arrayBuffer())
      const ext = mime.split('/')[1].replace('jpeg', 'jpg')
      const fileName = `termination-${Date.now()}.${ext}`
      const dir = path.join(process.cwd(), 'uploads', 'terminations', tenant.id)
      await mkdir(dir, { recursive: true }).catch(() => {})
      await writeFile(path.join(dir, fileName), buf).catch(() => {})
      proofRelPath = `uploads/terminations/${tenant.id}/${fileName}`
      await prisma.tenantDocument.create({
        data: {
          organizationId,
          tenantId: tenant.id,
          docType: 'Termination Proof',
          filename: fileName,
          originalFilename: proof.name || fileName,
          filePath: proofRelPath,
          fileSize: buf.length,
          status: 'Uploaded',
          reviewNotes: `Uploaded at termination: ${reason.slice(0, 200)}`,
        },
      })
    }

    const now = new Date()
    await prisma.tenancyContract.updateMany({
      where: { organizationId, tenantId: tenant.id, status: 'Active' },
      data: {
        status: 'Terminated',
        terminatedAt: now,
        terminationReason: reason,
      },
    })

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        status: 'Terminated',
        passwordHash: '',
        notes: [
          tenant.notes || '',
          `Contract terminated on ${now.toISOString().slice(0, 10)}${effectiveDate ? ` (effective ${effectiveDate})` : ''}: ${reason}`,
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
          <p>Your tenant portal access has been disabled. For any questions, please contact <a href="mailto:info@cre.ae" style="color:#E30613;">info@cre.ae</a>.</p>
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
