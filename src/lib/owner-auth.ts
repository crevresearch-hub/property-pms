import { cookies } from 'next/headers'

export interface OwnerSession {
  id: string
  name: string
  email: string
  orgId: string
}

export function getOwnerSessionFromRequest(request: Request): OwnerSession | null {
  try {
    const cookieHeader = request.headers.get('cookie') || ''
    const m = cookieHeader.match(/owner_session=([^;]+)/)
    if (!m) return null
    const session = JSON.parse(decodeURIComponent(m[1])) as OwnerSession
    if (!session.id || !session.email || !session.orgId) return null
    return session
  } catch {
    return null
  }
}

export async function getOwnerSession(): Promise<OwnerSession | null> {
  try {
    const c = await cookies()
    const raw = c.get('owner_session')?.value
    if (!raw) return null
    const session = JSON.parse(raw) as OwnerSession
    if (!session.id || !session.email || !session.orgId) return null
    return session
  } catch {
    return null
  }
}
