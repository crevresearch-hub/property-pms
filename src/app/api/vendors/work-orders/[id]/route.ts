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

    const existing = await prisma.workOrder.findFirst({
      where: { id: id, organizationId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    if (body.scopeOfWork !== undefined) updateData.scopeOfWork = body.scopeOfWork
    if (body.startDate !== undefined) updateData.startDate = body.startDate
    if (body.expectedCompletion !== undefined) updateData.expectedCompletion = body.expectedCompletion
    if (body.actualCompletion !== undefined) updateData.actualCompletion = body.actualCompletion
    if (body.estimatedAmount !== undefined) updateData.estimatedAmount = parseFloat(body.estimatedAmount)
    if (body.actualAmount !== undefined) updateData.actualAmount = parseFloat(body.actualAmount)
    if (body.status !== undefined) updateData.status = body.status
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.vendorId !== undefined) updateData.vendorId = body.vendorId

    const workOrder = await prisma.workOrder.update({
      where: { id },
      data: updateData,
      include: {
        vendor: {
          select: { id: true, companyName: true },
        },
        ticket: {
          select: { id: true, ticketNo: true, title: true },
        },
      },
    })

    await logActivity(
      organizationId,
      session.user.name,
      'Updated Work Order',
      `Work order ${workOrder.workOrderNo} updated${body.status ? ` - status: ${body.status}` : ''}`
    )

    return NextResponse.json(workOrder)
  } catch (error) {
    console.error('PUT /api/vendors/work-orders/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
