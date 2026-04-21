import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { signOwnerSetupToken } from '@/lib/owner-setup-token'
import { sendEmail } from '@/lib/email'
import { logActivity } from '@/lib/activity'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const organizationId = session.user.organizationId
    const body = await request.json()
    const { email, ownerName, buildingName } = body

    if (!email || !ownerName || !buildingName) {
      return NextResponse.json(
        { error: 'email, ownerName, and buildingName are required' },
        { status: 400 }
      )
    }

    const existing = await prisma.propertyOwner.findFirst({
      where: { organizationId, email },
    })

    const owner = existing
      ? await prisma.propertyOwner.update({
          where: { id: existing.id },
          data: { ownerName, buildingName },
        })
      : await prisma.propertyOwner.create({
          data: {
            organizationId,
            email,
            ownerName,
            buildingName,
            phone: '',
          },
        })

    const token = signOwnerSetupToken(owner.id)
    const base = process.env.NEXTAUTH_URL || request.nextUrl.origin
    const setupUrl = `${base}/owner/setup/${token}`

    const html = `<!DOCTYPE html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f5f5f5;padding:32px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px">
    <div style="text-align:center;margin-bottom:24px">
      <p style="font-size:10px;font-weight:700;letter-spacing:3px;color:#d97706;margin:0">OWNER PORTAL</p>
      <h1 style="font-size:22px;color:#111;margin:8px 0 0 0">Set Up Your Account</h1>
    </div>
    <p style="color:#374151;font-size:15px;line-height:1.6">Hello <strong>${ownerName}</strong>,</p>
    <p style="color:#374151;font-size:15px;line-height:1.6">You've been invited to access the Alwaan Owner Portal for <strong>${buildingName}</strong>. Click below to set your password and log in:</p>
    <p style="text-align:center;margin:28px 0">
      <a href="${setupUrl}" style="display:inline-block;background:#d97706;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Set My Password</a>
    </p>
    <p style="color:#6b7280;font-size:13px;line-height:1.6">Or copy this link:<br/><a href="${setupUrl}" style="color:#d97706;word-break:break-all">${setupUrl}</a></p>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px;border-top:1px solid #e5e7eb;padding-top:16px">This link expires in 72 hours. If you didn't expect this email, ignore it.</p>
  </div>
</body></html>`

    const emailResult = await sendEmail({
      organizationId,
      to: email,
      toName: ownerName,
      subject: `Set up your Alwaan Owner Portal account`,
      html,
      template: 'owner-invite',
      triggeredBy: session.user.name,
      refType: 'PropertyOwner',
      refId: owner.id,
    })

    await logActivity(
      organizationId,
      session.user.name,
      existing ? 'Re-Invited Owner' : 'Invited Owner',
      `${ownerName} <${email}> for ${buildingName}`
    )

    return NextResponse.json({
      success: true,
      ownerId: owner.id,
      emailSent: emailResult.success,
      emailError: emailResult.error,
      setupUrl,
    })
  } catch (error) {
    console.error('POST /api/owner/invite error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
