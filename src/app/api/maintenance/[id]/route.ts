import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { createNotification } from '@/lib/notifications'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    const { id } = await params

    const ticket = await prisma.maintenanceTicket.findFirst({
      where: { id, organizationId },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        unit: {
          select: {
            id: true,
            unitNo: true,
          },
        },
        vendor: {
          select: {
            id: true,
            companyName: true,
            contactPerson: true,
            phone: true,
            email: true,
          },
        },
        comments: {
          orderBy: { createdAt: 'asc' },
        },
        workOrders: {
          include: {
            vendor: {
              select: { id: true, companyName: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    return NextResponse.json(ticket)
  } catch (error) {
    console.error('GET /api/maintenance/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    const { id } = await params
    const body = await request.json()

    const existing = await prisma.maintenanceTicket.findFirst({
      where: { id, organizationId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    if (body.category !== undefined) updateData.category = body.category
    if (body.priority !== undefined) updateData.priority = body.priority
    if (body.title !== undefined) updateData.title = body.title
    if (body.description !== undefined) updateData.description = body.description
    if (body.vendorId !== undefined) updateData.vendorId = body.vendorId || null
    if (body.estimatedCost !== undefined) updateData.estimatedCost = parseFloat(body.estimatedCost)
    if (body.actualCost !== undefined) updateData.actualCost = parseFloat(body.actualCost)

    // Status change with timestamp tracking
    if (body.status !== undefined && body.status !== existing.status) {
      updateData.status = body.status

      const now = new Date()

      switch (body.status) {
        case 'Acknowledged':
          if (!existing.acknowledgedAt) {
            updateData.acknowledgedAt = now
          }
          break
        case 'Assigned':
        case 'In Progress':
          if (!existing.assignedAt) {
            updateData.assignedAt = now
          }
          break
        case 'Completed':
          if (!existing.completedAt) {
            updateData.completedAt = now
          }
          break
        case 'Closed':
          if (!existing.closedAt) {
            updateData.closedAt = now
          }
          break
      }

      // Notify tenant of status change
      if (existing.tenantId) {
        await createNotification(
          organizationId,
          'tenant',
          existing.tenantId,
          `Ticket ${existing.ticketNo} updated to ${body.status}`,
          `Your maintenance request "${existing.title}" has been updated to ${body.status}.`,
          'maintenance'
        )
      }
    }

    // If vendor is being assigned, set assignedAt
    if (body.vendorId && !existing.vendorId && !existing.assignedAt) {
      updateData.assignedAt = new Date()
    }

    const ticket = await prisma.maintenanceTicket.update({
      where: { id },
      data: updateData,
      include: {
        tenant: { select: { id: true, name: true } },
        unit: { select: { id: true, unitNo: true } },
        vendor: { select: { id: true, companyName: true } },
        comments: { orderBy: { createdAt: 'asc' } },
      },
    })

    await logActivity(
      organizationId,
      session.user.name,
      'Updated Maintenance Ticket',
      `Ticket ${ticket.ticketNo} updated${body.status ? ` - status: ${body.status}` : ''}`
    )

    return NextResponse.json(ticket)
  } catch (error) {
    console.error('PUT /api/maintenance/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    const { id } = await params

    const ticket = await prisma.maintenanceTicket.findFirst({
      where: { id, organizationId },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    if (ticket.status === 'In Progress' || ticket.status === 'Assigned') {
      return NextResponse.json(
        { error: 'Cannot delete a ticket that is in progress or assigned. Close it first.' },
        { status: 400 }
      )
    }

    await prisma.maintenanceTicket.delete({
      where: { id },
    })

    await logActivity(
      organizationId,
      session.user.name,
      'Deleted Maintenance Ticket',
      `Ticket ${ticket.ticketNo} deleted`
    )

    return NextResponse.json({ message: 'Ticket deleted successfully' })
  } catch (error) {
    console.error('DELETE /api/maintenance/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
