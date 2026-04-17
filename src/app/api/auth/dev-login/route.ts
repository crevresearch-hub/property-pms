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
      name: 'CRE Admin',
      email: 'admin@cre.ae',
      organizationId: 'cmnwqn5tk0000ohnoi0mpqe4x',
      role: 'admin',
      sub: 'admin-dev',
    },
    secret,
    maxAge: 60 * 60 * 24 * 7,
  })

  const redirect = request.nextUrl.searchParams.get('to') || '/dashboard'
  const res = NextResponse.redirect(new URL(redirect, request.url))

  const cookieStore = await cookies()
  cookieStore.set('next-auth.session-token', token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })

  return res
}
