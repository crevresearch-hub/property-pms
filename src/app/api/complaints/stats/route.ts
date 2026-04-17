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

    const complaints = await prisma.complaint.findMany({
      where: { organizationId },
      select: { status: true, category: true },
    })

    const total = complaints.length
    const open = complaints.filter((c: { status: string }) => c.status === 'Open').length
    const in_progress = complaints.filter((c: { status: string }) => c.status === 'In Progress').length
    const resolved = complaints.filter((c: { status: string }) => c.status === 'Resolved').length

    const by_category: Record<string, number> = {}
    for (const c of complaints as { category: string }[]) {
      by_category[c.category] = (by_category[c.category] || 0) + 1
    }

    return NextResponse.json({
      total,
      open,
      in_progress,
      resolved,
      by_category,
    })
  } catch (error) {
    console.error('GET /api/complaints/stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
