import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { cookies } from 'next/headers'
import prisma from '@/lib/prisma'

async function devGate(): Promise<boolean> {
  const c = await cookies()
  return c.get('dev_unlocked')?.value === '1'
}

// Developer-only inbox listing. Returns all update requests for the org,
// newest first, optionally filtered by status (?status=pending|resolved|declined).
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Developer auth via either the dev-login NextAuth session (id="admin-dev")
    // or the dev_unlocked cookie set on /dashboard/developer.
    const isDeveloper =
      session.user.id === 'admin-dev' ||
      session.user.email === 'admin@cre.ae' ||
      (await devGate())
    if (!isDeveloper) {
      return NextResponse.json({ error: 'Developer-only endpoint' }, { status: 403 })
    }

    const organizationId = session.user.organizationId
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined

    const where: Record<string, unknown> = { organizationId }
    if (status) where.status = status

    const requests = await prisma.updateRequest.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json(requests)
  } catch (error) {
    console.error('GET /api/update-requests error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
