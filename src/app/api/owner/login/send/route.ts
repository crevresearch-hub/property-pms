import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { signOwnerSetupToken } from '@/lib/owner-setup-token'
import { sendEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const owner = await prisma.propertyOwner.findFirst({
      where: { email },
      include: { organization: { select: { id: true, isActive: true } } },
    })

    // Always return success to avoid leaking which emails are registered
    if (!owner || !owner.organization.isActive) {
      return NextResponse.json({
        success: true,
        message: 'If an owner account exists for that email, a sign-in link has been sent.',
      })
    }

    // 1-hour token for magic link login
    const token = signOwnerSetupToken(owner.id, 1)
    const base = process.env.NEXTAUTH_URL || request.nextUrl.origin
    const loginUrl = `${base.replace(/\/$/, '')}/api/owner/login/verify?token=${encodeURIComponent(token)}`

    const html = `<!DOCTYPE html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f5f5f5;padding:32px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px">
    <div style="text-align:center;margin-bottom:24px">
      <p style="font-size:10px;font-weight:700;letter-spacing:3px;color:#d97706;margin:0">OWNER PORTAL</p>
      <h1 style="font-size:22px;color:#111;margin:8px 0 0 0">Your Sign-In Link</h1>
    </div>
    <p style="color:#374151;font-size:15px;line-height:1.6">Hello <strong>${owner.ownerName}</strong>,</p>
    <p style="color:#374151;font-size:15px;line-height:1.6">Click the button below to sign in to the Alwaan Owner Portal for <strong>${owner.buildingName}</strong>:</p>
    <p style="text-align:center;margin:28px 0">
      <a href="${loginUrl}" style="display:inline-block;background:#d97706;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Sign In Now</a>
    </p>
    <p style="color:#6b7280;font-size:13px;line-height:1.6">Or paste this link into your browser:<br/><a href="${loginUrl}" style="color:#d97706;word-break:break-all">${loginUrl}</a></p>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px;border-top:1px solid #e5e7eb;padding-top:16px">This link expires in <strong>1 hour</strong> and can only be used once. If you didn't request this, ignore this email.</p>
  </div>
</body></html>`

    await sendEmail({
      organizationId: owner.organization.id,
      to: owner.email,
      toName: owner.ownerName,
      subject: 'Your Alwaan Owner Portal sign-in link',
      html,
      template: 'owner-magic-link',
      refType: 'PropertyOwner',
      refId: owner.id,
    })

    return NextResponse.json({
      success: true,
      message: 'If an owner account exists for that email, a sign-in link has been sent.',
    })
  } catch (error) {
    console.error('POST /api/owner/login/send error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
