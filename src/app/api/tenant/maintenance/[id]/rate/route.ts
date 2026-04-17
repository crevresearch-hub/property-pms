import { NextRequest, NextResponse } from 'next/server'
import { getTenantSession } from '@/lib/tenant-auth'
import prisma from '@/lib/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getTenantSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const { rating, ratingComment } = await request.json()

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 })
    }

    // Verify ticket belongs to tenant and is completed/closed
    const ticket = await prisma.maintenanceTicket.findFirst({
      where: {
        id,
        tenantId: session.id,
        organizationId: session.orgId,
        status: { in: ['Completed', 'Closed'] },
      },
    })

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found or not yet completed' },
        { status: 404 }
      )
    }

    const updated = await prisma.maintenanceTicket.update({
      where: { id },
      data: {
        rating,
        ratingComment: ratingComment || '',
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PUT /api/tenant/maintenance/[id]/rate error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
