import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * GET /api/owner/auth/dev-login?email=<owner-email>
 *
 * Dev-only one-click owner sign-in (skips the magic-link email step) so
 * demo owners can be opened directly. Disabled when NODE_ENV=production.
 */
export async function GET(request: NextRequest) {
  if (process.env.DISABLE_DEV_LOGIN === 'true') {
    return NextResponse.json({ error: 'Disabled in production' }, { status: 403 })
  }

  const email = (request.nextUrl.searchParams.get('email') || '').trim().toLowerCase()
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const owner = await prisma.propertyOwner.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, ownerName: true, email: true, organizationId: true },
  })
  if (!owner) return NextResponse.json({ error: 'Owner not found' }, { status: 404 })

  const session = {
    id: owner.id,
    name: owner.ownerName,
    email: owner.email,
    orgId: owner.organizationId,
  }

  // Redirect straight to the owner dashboard with the cookie set
  const res = NextResponse.redirect(new URL('/owner/dashboard', request.url))
  res.cookies.set('owner_session', JSON.stringify(session), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
  return res
}
