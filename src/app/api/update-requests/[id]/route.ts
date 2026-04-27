import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { cookies } from 'next/headers'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

async function devGate(): Promise<boolean> {
  const c = await cookies()
  return c.get('dev_unlocked')?.value === '1'
}

// Developer triage: mark a request resolved / declined / re-pending,
// optionally with a resolver note. Org-scoped + developer-gated.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const isDeveloper =
      session.user.id === 'admin-dev' ||
      session.user.email === 'admin@cre.ae' ||
      (await devGate())
    if (!isDeveloper) {
      return NextResponse.json({ error: 'Developer-only endpoint' }, { status: 403 })
    }

    const { id } = await params
    const organizationId = session.user.organizationId
    const body = await request.json()
    const { status, resolverNote } = body as { status?: string; resolverNote?: string }

    const allowed = ['pending', 'resolved', 'declined']
    if (status && !allowed.includes(status)) {
      return NextResponse.json({ error: `status must be one of ${allowed.join(', ')}` }, { status: 400 })
    }

    const existing = await prisma.updateRequest.findFirst({ where: { id, organizationId } })
    if (!existing) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (status) {
      data.status = status
      if (status === 'pending') {
        data.resolvedAt = null
        data.resolvedBy = ''
      } else {
        data.resolvedAt = new Date()
        data.resolvedBy = session.user.name || session.user.email || 'developer'
      }
    }
    if (typeof resolverNote === 'string') data.resolverNote = resolverNote

    const updated = await prisma.updateRequest.update({ where: { id }, data })

    await logActivity(
      organizationId,
      session.user.name || session.user.email || 'developer',
      `Update Request ${status || 'updated'}`,
      `${existing.refLabel || existing.type}: ${existing.message.slice(0, 200)}`
    )

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/update-requests/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
