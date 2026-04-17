import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { hash } from 'bcryptjs'
import crypto from 'crypto'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { sendEmail } from '@/lib/email'

/**
 * Generate a memorable-ish random password.
 */
function randomPassword(length = 10): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const bytes = crypto.randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length]
  return out
}

/**
 * POST /api/tenants/[id]/portal-password
 *
 * Body options:
 *   { password: string }   -> use provided password
 *   { generate: true }     -> auto-generate a password (default)
 *   { sendEmail: true }    -> email credentials to tenant after saving
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
    const body = (await request.json().catch(() => ({}))) as {
      password?: string
      generate?: boolean
      sendEmail?: boolean
    }

    const tenant = await prisma.tenant.findFirst({
      where: { id, organizationId },
    })
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    if (!tenant.email) {
      return NextResponse.json(
        { error: 'Tenant has no email on file. Add an email before setting portal access.' },
        { status: 400 }
      )
    }

    const newPassword =
      body.password && body.password.length >= 6
        ? body.password
        : randomPassword(10)

    const passwordHash = await hash(newPassword, 10)

    await prisma.tenant.update({
      where: { id },
      data: { passwordHash },
    })

    await logActivity(
      organizationId,
      session.user.name,
      'Set Tenant Portal Password',
      `Portal password set for tenant ${tenant.name}`
    )

    let emailSent = false
    let emailError: string | null = null

    if (body.sendEmail) {
      const baseUrl = process.env.NEXTAUTH_URL || ''
      const loginUrl = `${baseUrl.replace(/\/$/, '')}/tenant/login`
      const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#111;">
  <div style="max-width:560px;margin:24px auto;padding:32px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;">
    <div style="height:4px;width:48px;background:#E30613;border-radius:2px;margin-bottom:20px;"></div>
    <h1 style="margin:0 0 14px 0;font-size:22px;">Welcome to the Tenant Portal</h1>
    <p style="margin:0 0 12px 0;">Dear ${tenant.name},</p>
    <p style="margin:0 0 12px 0;">Your tenant portal account is now active. Use the credentials below to sign in and manage your invoices, maintenance requests, documents, and renewals.</p>
    <table style="width:100%;margin:18px 0;border:1px solid #e5e7eb;border-radius:6px;background:#fafafa;">
      <tr><td style="padding:10px;font-size:12px;color:#6b7280;width:40%;">Portal URL</td><td style="padding:10px;font-size:13px;font-weight:600;"><a href="${loginUrl}" style="color:#E30613;text-decoration:none;">${loginUrl}</a></td></tr>
      <tr><td style="padding:10px;font-size:12px;color:#6b7280;">Email</td><td style="padding:10px;font-size:13px;font-weight:600;">${tenant.email}</td></tr>
      <tr><td style="padding:10px;font-size:12px;color:#6b7280;">Temporary Password</td><td style="padding:10px;font-size:15px;font-weight:700;font-family:monospace;">${newPassword}</td></tr>
    </table>
    <p style="margin:14px 0 0 0;font-size:12px;color:#6b7280;">For your security, please change this password after your first login.</p>
  </div>
</body></html>`

      const result = await sendEmail({
        organizationId,
        to: tenant.email,
        toName: tenant.name,
        subject: 'Your Tenant Portal Access',
        html,
        template: 'tenant_portal_welcome',
        triggeredBy: session.user.name,
        refType: 'tenant',
        refId: tenant.id,
      })
      emailSent = result.success
      emailError = result.error || null
    }

    // Only return the plaintext password if we generated it, so staff can copy
    const generated = !body.password
    return NextResponse.json({
      message: 'Portal password updated',
      password: generated ? newPassword : undefined,
      emailSent,
      emailError,
    })
  } catch (error) {
    console.error('POST /api/tenants/[id]/portal-password error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/tenants/[id]/portal-password
 *
 * Disable the tenant portal by clearing the passwordHash. The tenant cannot
 * log in until a new password is issued via POST.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const organizationId = session.user.organizationId
    const { id } = await params

    const tenant = await prisma.tenant.findFirst({ where: { id, organizationId } })
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    await prisma.tenant.update({ where: { id }, data: { passwordHash: '' } })
    await logActivity(
      organizationId,
      session.user.name,
      'Disabled Tenant Portal',
      `Portal access disabled for tenant ${tenant.name}`
    )
    return NextResponse.json({ message: 'Portal access disabled' })
  } catch (error) {
    console.error('DELETE /api/tenants/[id]/portal-password error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
