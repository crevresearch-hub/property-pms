import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function POST(
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

    const { message, authorType, attachment } = body

    if (!message || !message.trim()) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Verify ticket belongs to organization
    const ticket = await prisma.maintenanceTicket.findFirst({
      where: { id: id, organizationId },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    const comment = await prisma.ticketComment.create({
      data: {
        ticketId: id,
        author: session.user.name,
        authorType: authorType || 'staff',
        message: message.trim(),
        attachment: attachment || '',
      },
    })

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    console.error('POST /api/maintenance/[id]/comments error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
