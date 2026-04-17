import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

async function generateWorkOrderNo(organizationId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `WO-${year}-`

  const lastWO = await prisma.workOrder.findFirst({
    where: {
      organizationId,
      workOrderNo: { startsWith: prefix },
    },
    orderBy: { workOrderNo: 'desc' },
    select: { workOrderNo: true },
  })

  let nextNum = 1
  if (lastWO) {
    const lastNum = parseInt(lastWO.workOrderNo.replace(prefix, ''), 10)
    if (!isNaN(lastNum)) {
      nextNum = lastNum + 1
    }
  }

  return `${prefix}${nextNum.toString().padStart(4, '0')}`
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId

    const workOrders = await prisma.workOrder.findMany({
      where: { organizationId },
      include: {
        vendor: {
          select: {
            id: true,
            companyName: true,
            contactPerson: true,
            phone: true,
          },
        },
        ticket: {
          select: {
            id: true,
            ticketNo: true,
            title: true,
            status: true,
            priority: true,
            tenant: { select: { id: true, name: true } },
            unit: { select: { id: true, unitNo: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(workOrders)
  } catch (error) {
    console.error('GET /api/vendors/work-orders error:', error)
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

    const {
      vendorId,
      ticketId,
      scopeOfWork,
      startDate,
      expectedCompletion,
      estimatedAmount,
      notes,
    } = body

    if (!vendorId) {
      return NextResponse.json(
        { error: 'Vendor ID is required' },
        { status: 400 }
      )
    }

    // Verify vendor belongs to organization
    const vendor = await prisma.vendor.findFirst({
      where: { id: vendorId, organizationId },
    })
    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    // Verify ticket belongs to organization if provided
    if (ticketId) {
      const ticket = await prisma.maintenanceTicket.findFirst({
        where: { id: ticketId, organizationId },
      })
      if (!ticket) {
        return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
      }
    }

    const workOrderNo = await generateWorkOrderNo(organizationId)

    const workOrder = await prisma.workOrder.create({
      data: {
        organizationId,
        workOrderNo,
        vendorId,
        ticketId: ticketId || null,
        scopeOfWork: scopeOfWork || '',
        startDate: startDate || '',
        expectedCompletion: expectedCompletion || '',
        estimatedAmount: estimatedAmount ? parseFloat(estimatedAmount) : 0,
        status: 'Issued',
        notes: notes || '',
      },
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
      'Created Work Order',
      `Work order ${workOrderNo} issued to ${vendor.companyName}`
    )

    return NextResponse.json(workOrder, { status: 201 })
  } catch (error) {
    console.error('POST /api/vendors/work-orders error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
