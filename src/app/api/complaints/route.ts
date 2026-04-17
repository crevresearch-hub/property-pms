import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { createNotification } from '@/lib/notifications'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId

    const complaints = await prisma.complaint.findMany({
      where: { organizationId },
      include: {
        tenant: {
          select: { id: true, name: true, phone: true, email: true },
        },
        unit: {
          select: { id: true, unitNo: true },
        },
      },
      orderBy: [
        { status: 'asc' }, // Open first (alphabetically: In Progress, Open, Resolved)
        { createdAt: 'desc' },
      ],
    })

    // Custom sort: Open first, then In Progress, then Resolved
    const statusOrder: Record<string, number> = { Open: 0, 'In Progress': 1, Resolved: 2 }
    complaints.sort((a: { status: string; createdAt: Date }, b: { status: string; createdAt: Date }) => {
      const orderA = statusOrder[a.status] ?? 99
      const orderB = statusOrder[b.status] ?? 99
      if (orderA !== orderB) return orderA - orderB
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    return NextResponse.json(complaints)
  } catch (error) {
    console.error('GET /api/complaints error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    const body = await request.json()

    const { tenantId, unitId, category, subject, description, priority } = body

    if (!subject) {
      return NextResponse.json({ error: 'Subject is required' }, { status: 400 })
    }

    // Verify tenant belongs to organization if provided
    if (tenantId) {
      const tenant = await prisma.tenant.findFirst({
        where: { id: tenantId, organizationId },
      })
      if (!tenant) {
        return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
      }
    }

    // Verify unit belongs to organization if provided
    if (unitId) {
      const unit = await prisma.unit.findFirst({
        where: { id: unitId, organizationId },
      })
      if (!unit) {
        return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
      }
    }

    // Generate complaint number: CMP-YYYY-NNNN
    const year = new Date().getFullYear()
    const count = await prisma.complaint.count({
      where: {
        organizationId,
        complaintNo: { startsWith: `CMP-${year}-` },
      },
    })
    const complaintNo = `CMP-${year}-${String(count + 1).padStart(4, '0')}`

    const complaint = await prisma.complaint.create({
      data: {
        organizationId,
        complaintNo,
        tenantId: tenantId || null,
        unitId: unitId || null,
        category: category || 'General',
        subject,
        description: description || '',
        priority: priority || 'Medium',
        status: 'Open',
      },
      include: {
        tenant: { select: { id: true, name: true } },
        unit: { select: { id: true, unitNo: true } },
      },
    })

    // Notify admin about new complaint
    await createNotification(
      organizationId,
      'staff',
      '',
      `New Complaint: ${complaintNo}`,
      `${subject} - Priority: ${priority || 'Medium'}`,
      'complaint'
    )

    await logActivity(
      organizationId,
      session.user.name,
      'Created Complaint',
      `Complaint ${complaintNo}: ${subject}`
    )

    return NextResponse.json(complaint, { status: 201 })
  } catch (error) {
    console.error('POST /api/complaints error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
