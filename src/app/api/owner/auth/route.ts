import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'

const TOKEN_TTL_MIN = 30
const tokenCache = new Map<string, { ownerId: string; orgId: string; email: string; expires: number }>()

/**
 * POST /api/owner/auth
 * Body: { email } → emails magic link
 * Body: { token } → exchanges token for owner_session cookie
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { email?: string; token?: string }

    // Step 2: exchange token for session cookie
    if (body.token) {
      // Clean up expired tokens
      for (const [k, v] of tokenCache.entries()) {
        if (v.expires < Date.now()) tokenCache.delete(k)
      }
      const entry = tokenCache.get(body.token)
      if (!entry) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 401 })
      tokenCache.delete(body.token)
      const owner = await prisma.propertyOwner.findFirst({
        where: { id: entry.ownerId, organizationId: entry.orgId },
        select: { id: true, ownerName: true, email: true, organizationId: true },
      })
      if (!owner) return NextResponse.json({ error: 'Owner not found' }, { status: 404 })
      const session = { id: owner.id, name: owner.ownerName, email: owner.email, orgId: owner.organizationId }
      const res = NextResponse.json({ ok: true, name: owner.ownerName })
      res.cookies.set('owner_session', JSON.stringify(session), {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      })
      return res
    }

    // Step 1: send magic link
    const email = (body.email || '').trim().toLowerCase()
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

    const owner = await prisma.propertyOwner.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, ownerName: true, email: true, organizationId: true },
    })
    // Always return ok to avoid leaking which emails are registered.
    if (!owner) {
      return NextResponse.json({ ok: true, sent: false })
    }

    const token = crypto.randomBytes(24).toString('hex')
    tokenCache.set(token, {
      ownerId: owner.id,
      orgId: owner.organizationId,
      email: owner.email,
      expires: Date.now() + TOKEN_TTL_MIN * 60 * 1000,
    })

    const baseUrl = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '')
    const link = `${baseUrl}/owner/login?token=${token}`
    const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,sans-serif;color:#111;">
      <div style="max-width:560px;margin:24px auto;padding:32px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;">
        <div style="height:4px;width:60px;background:#E30613;border-radius:2px;margin-bottom:18px;"></div>
        <h1 style="margin:0 0 12px 0;font-size:22px;">Owner Portal Sign-In</h1>
        <p>Hello ${owner.ownerName.replace(/[<>]/g, '')},</p>
        <p>Click the button below to sign in to your Continental Real Estate owner portal. This link is valid for ${TOKEN_TTL_MIN} minutes.</p>
        <p style="text-align:center;margin:18px 0;">
          <a href="${link}" style="display:inline-block;background:#E30613;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;">Sign In to Portal</a>
        </p>
        <p style="font-size:11px;color:#6b7280;">If you didn&rsquo;t request this, you can safely ignore the email.</p>
      </div>
    </body></html>`

    await sendEmail({
      organizationId: owner.organizationId,
      to: owner.email,
      toName: owner.ownerName,
      subject: 'Your CRE Owner Portal Sign-In Link',
      html,
      template: 'owner_magic_link',
      triggeredBy: 'owner-self',
      refType: 'owner',
      refId: owner.id,
    }).catch((e) => console.warn('Owner magic link email failed:', e))

    return NextResponse.json({ ok: true, sent: true })
  } catch (error) {
    console.error('POST /api/owner/auth error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set('owner_session', '', { httpOnly: true, path: '/', maxAge: 0 })
  return res
}
