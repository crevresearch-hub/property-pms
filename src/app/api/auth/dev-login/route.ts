import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { encode } from 'next-auth/jwt'

/**
 * GET /api/auth/dev-login
 *
 * Dev-only one-click PM/CEO sign-in. Sets the NextAuth session cookie
 * directly so the user lands on the dashboard without a login form.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET || 'super-secret-key-change-in-production-abc123xyz'

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
