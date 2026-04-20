import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { encode } from 'next-auth/jwt'

/**
 * GET /api/auth/dev-login
 *
 * Dev-only one-click PM/CEO sign-in. Gated behind ENABLE_DEV_LOGIN=true;
 * the endpoint 404s in any environment without that flag set.
 */
export async function GET(request: NextRequest) {
  if (process.env.ENABLE_DEV_LOGIN !== 'true') {
    return new NextResponse('Not Found', { status: 404 })
  }

  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'NEXTAUTH_SECRET not configured' }, { status: 500 })
  }

  // Create a JWT token for admin user
  const token = await encode({
    token: {
      id: 'admin-dev',
      name: 'Alwaan Admin',
      email: 'admin@cre.ae',
      organizationId: 'cmo2o53dc0000ohh0dfneceit',
      role: 'admin',
      sub: 'admin-dev',
    },
    secret,
    maxAge: 60 * 60 * 24 * 7,
  })

  const redirect = request.nextUrl.searchParams.get('to') || '/dashboard'
  const res = NextResponse.redirect(new URL(redirect, request.url))

  const isSecure = request.url.startsWith('https')
  const cookieName = isSecure ? '__Secure-next-auth.session-token' : 'next-auth.session-token'

  const cookieStore = await cookies()
  cookieStore.set(cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecure,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })

  return res
}
