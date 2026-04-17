import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId

    const [
      open,
      assigned,
      emergency,
      completed,
      inProgress,
      submitted,
      escalated,
      closed,
      total,
    ] = await Promise.all([
      prisma.maintenanceTicket.count({
        where: { organizationId, status: { in: ['Submitted', 'Acknowledged'] } },
      }),
      prisma.maintenanceTicket.count({
        where: { organizationId, status: 'Assigned' },
      }),
      prisma.maintenanceTicket.count({
        where: { organizationId, priority: 'Emergency', status: { not: 'Closed' } },
      }),
      prisma.maintenanceTicket.count({
        where: { organizationId, status: 'Completed' },
      }),
      prisma.maintenanceTicket.count({
        where: { organizationId, status: 'In Progress' },
      }),
      prisma.maintenanceTicket.count({
        where: { organizationId, status: 'Submitted' },
      }),
      prisma.maintenanceTicket.count({
        where: { organizationId, status: 'Escalated' },
      }),
      prisma.maintenanceTicket.count({
        where: { organizationId, status: 'Closed' },
      }),
      prisma.maintenanceTicket.count({
        where: { organizationId },
      }),
    ])

    // Average rating for completed/closed tickets with ratings
    const ratedTickets = await prisma.maintenanceTicket.findMany({
      where: {
        organizationId,
        rating: { gt: 0 },
      },
      select: { rating: true },
    })

    const averageRating = ratedTickets.length > 0
      ? ratedTickets.reduce((sum: number, t: { rating: number }) => sum + t.rating, 0) / ratedTickets.length
      : 0

    return NextResponse.json({
      open,
      assigned,
      emergency,
      completed,
      inProgress,
      submitted,
      escalated,
      closed,
      total,
      averageRating: Math.round(averageRating * 100) / 100,
      totalRated: ratedTickets.length,
    })
  } catch (error) {
    console.error('GET /api/maintenance/stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
