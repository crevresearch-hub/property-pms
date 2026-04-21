import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Multi-tenant middleware.
 * Extracts the organization slug from:
 *   1. The x-org-slug request header (for API clients)
 *   2. The subdomain (e.g., acme.propertypms.com -> "acme")
 *   3. Falls back to NEXT_PUBLIC_DEFAULT_ORG_SLUG env var (for local dev)
 */

const PUBLIC_PATHS = ['/login', '/api/auth', '/_next', '/favicon.ico', '/images']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  let slug = request.headers.get('x-org-slug')

  if (!slug) {
    const host = request.headers.get('host') || ''
    const parts = host.split('.')
    if (parts.length >= 3 && parts[0] !== 'www') {
      slug = parts[0]
    }
  }

  if (!slug) {
    slug = process.env.NEXT_PUBLIC_DEFAULT_ORG_SLUG || ''
  }

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
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
