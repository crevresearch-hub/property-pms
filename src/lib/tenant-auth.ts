import { cookies } from 'next/headers'

export interface TenantSession {
  id: string
  name: string
  orgId: string
}

/**
 * Parse tenant_session cookie from a Request object (for API routes).
 */
export function getTenantSession(request: Request): TenantSession | null {
  try {
    const cookieHeader = request.headers.get('cookie') || ''
    const match = cookieHeader.match(/tenant_session=([^;]+)/)
    if (!match) return null
    const decoded = decodeURIComponent(match[1])
    const session = JSON.parse(decoded) as TenantSession
    if (!session.id || !session.name || !session.orgId) return null
    return session
  } catch {
    return null
  }
}

/**
 * Parse tenant_session cookie from Next.js cookies() (for server components / layouts).
 */
export async function getTenantSessionFromCookies(): Promise<TenantSession | null> {
  try {
    const cookieStore = await cookies()
    const raw = cookieStore.get('tenant_session')?.value
    if (!raw) return null
    const session = JSON.parse(raw) as TenantSession
    if (!session.id || !session.name || !session.orgId) return null
    return session
  } catch {
    return null
  }
}
