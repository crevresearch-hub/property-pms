import { NextRequest, NextResponse } from 'next/server'
import { getTenantSession } from '@/lib/tenant-auth'
import prisma from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getTenantSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const { message } = await request.json()

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Verify ticket belongs to tenant
    const ticket = await prisma.maintenanceTicket.findFirst({
      where: { id, tenantId: session.id, organizationId: session.orgId },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    const comment = await prisma.ticketComment.create({
      data: {
        ticketId: id,
        author: session.name,
        authorType: 'tenant',
        message,
      },
    })

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    console.error('POST /api/tenant/maintenance/[id]/comment error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
