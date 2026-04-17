import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    const body = await request.json()

    const { rating, ratingComment } = body

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      )
    }

    const ticket = await prisma.maintenanceTicket.findFirst({
      where: { id: id, organizationId },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    if (ticket.status !== 'Completed' && ticket.status !== 'Closed') {
      return NextResponse.json(
        { error: 'Can only rate completed or closed tickets' },
        { status: 400 }
      )
    }

    const updated = await prisma.maintenanceTicket.update({
      where: { id },
      data: {
        rating: parseInt(String(rating), 10),
        ratingComment: ratingComment || '',
      },
      include: {
        tenant: { select: { id: true, name: true } },
        unit: { select: { id: true, unitNo: true } },
      },
    })

    await logActivity(
      organizationId,
      session.user.name,
      'Rated Maintenance Ticket',
      `Ticket ${ticket.ticketNo} rated ${rating}/5`
    )

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PUT /api/maintenance/[id]/rate error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
