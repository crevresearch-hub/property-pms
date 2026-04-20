import { cookies } from 'next/headers'

export interface OwnerSession {
  id: string
  name: string
  orgId: string
  buildingName: string
}

export function getOwnerSession(request: Request): OwnerSession | null {
  try {
    const cookieHeader = request.headers.get('cookie') || ''
    const match = cookieHeader.match(/owner_session=([^;]+)/)
    if (!match) return null
    const decoded = decodeURIComponent(match[1])
    const session = JSON.parse(decoded) as OwnerSession
    if (!session.id || !session.orgId) return null
    return session
  } catch {
    return null
  }
}

export async function getOwnerSessionFromCookies(): Promise<OwnerSession | null> {
  try {
    const cookieStore = await cookies()
    const raw = cookieStore.get('owner_session')?.value
    if (!raw) return null
    const session = JSON.parse(raw) as OwnerSession
    if (!session.id || !session.orgId) return null
    return session
  } catch {
    return null
  }
}
