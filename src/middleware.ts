import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { CEO_COOKIE_NAME, verifyCeoSession } from '@/lib/ceo-auth'

/**
 * Multi-tenant middleware.
 * Extracts the organization slug from:
 *   1. The x-org-slug request header (for API clients)
 *   2. The subdomain (e.g., acme.propertypms.com -> "acme")
 *   3. Falls back to NEXT_PUBLIC_DEFAULT_ORG_SLUG env var (for local dev)
 *
 * The resolved slug is forwarded as the x-org-slug header so that
 * API routes and server components can read it.
 *
 * Also gates all /ceo and /api/ceo routes behind a signed CEO session
 * cookie (see src/lib/ceo-auth.ts).
 */

const PUBLIC_PATHS = ['/login', '/api/auth', '/_next', '/favicon.ico', '/images']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // CEO gate: all /ceo and /api/ceo routes except the login pages themselves
  const isCeoPage = pathname.startsWith('/ceo') && pathname !== '/ceo/login'
  const isCeoApi = pathname.startsWith('/api/ceo') && pathname !== '/api/ceo/auth'
  if (isCeoPage || isCeoApi) {
    const token = request.cookies.get(CEO_COOKIE_NAME)?.value
    const valid = await verifyCeoSession(token, process.env.CEO_SESSION_SECRET)
    if (!valid) {
      if (isCeoApi) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      const loginUrl = new URL('/ceo/login', request.url)
      loginUrl.searchParams.set('to', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // Skip slug resolution for public/static paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // 1. Check explicit header (API clients, testing)
  let slug = request.headers.get('x-org-slug')

  // 2. Extract from subdomain
  if (!slug) {
    const host = request.headers.get('host') || ''
    const parts = host.split('.')
    // Subdomain exists if there are 3+ parts (e.g., acme.propertypms.com)
    // Exclude "www" as a subdomain
    if (parts.length >= 3 && parts[0] !== 'www') {
      slug = parts[0]
    }
  }

  // 3. Fall back to default org for local development
  if (!slug) {
    slug = process.env.NEXT_PUBLIC_DEFAULT_ORG_SLUG || ''
  }

  // Forward slug as header for downstream use (auth handles actual auth check)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-org-slug', slug || '')

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
