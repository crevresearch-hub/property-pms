import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { createNotification } from '@/lib/notifications'

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

    // Verify complaint belongs to organization
    const existing = await prisma.complaint.findFirst({
      where: { id, organizationId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Complaint not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    if (body.status !== undefined) updateData.status = body.status
    if (body.resolution !== undefined) updateData.resolution = body.resolution
    if (body.assignedTo !== undefined) updateData.assignedTo = body.assignedTo
    if (body.priority !== undefined) updateData.priority = body.priority
    if (body.category !== undefined) updateData.category = body.category

    // Set resolvedAt when status changes to Resolved
    if (body.status === 'Resolved' && existing.status !== 'Resolved') {
      updateData.resolvedAt = new Date()
    }

    const complaint = await prisma.complaint.update({
      where: { id },
      data: updateData,
      include: {
        tenant: { select: { id: true, name: true } },
        unit: { select: { id: true, unitNo: true } },
      },
    })

    // Notify tenant when complaint is resolved
    if (body.status === 'Resolved' && existing.status !== 'Resolved' && complaint.tenantId) {
      await createNotification(
        organizationId,
        'tenant',
        complaint.tenantId,
        `Complaint Resolved: ${complaint.complaintNo}`,
        complaint.resolution || 'Your complaint has been resolved.',
        'complaint'
      )
    }

    await logActivity(
      organizationId,
      session.user.name,
      'Updated Complaint',
      `Complaint ${complaint.complaintNo} updated - Status: ${complaint.status}`
    )

    return NextResponse.json(complaint)
  } catch (error) {
    console.error('PUT /api/complaints/[id] error:', error)
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

    const existing = await prisma.complaint.findFirst({
      where: { id, organizationId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Complaint not found' }, { status: 404 })
    }

    await prisma.complaint.delete({ where: { id } })

    await logActivity(
      organizationId,
      session.user.name,
      'Deleted Complaint',
      `Complaint ${existing.complaintNo} deleted`
    )

    return NextResponse.json({ message: 'Complaint deleted' })
  } catch (error) {
    console.error('DELETE /api/complaints/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
