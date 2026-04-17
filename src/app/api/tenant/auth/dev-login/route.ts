import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * GET /api/tenant/auth/dev-login?email=<tenant-email>
 * Dev-only one-click tenant sign-in.
 */
export async function GET(request: NextRequest) {
  if (process.env.DISABLE_DEV_LOGIN === 'true') {
    return NextResponse.json({ error: 'Disabled in production' }, { status: 403 })
  }
  const email = (request.nextUrl.searchParams.get('email') || '').trim().toLowerCase()
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const tenant = await prisma.tenant.findFirst({
    where: { email: { equals: email, mode: 'insensitive' }, status: 'Active' },
    include: { organization: { select: { id: true } } },
  })
  if (!tenant) return NextResponse.json({ error: 'Tenant not found or not active' }, { status: 404 })

  const session = { id: tenant.id, name: tenant.name, orgId: tenant.organizationId }
  const res = NextResponse.redirect(new URL('/tenant/dashboard', request.url))
  res.cookies.set('tenant_session', JSON.stringify(session), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
  return res
}
