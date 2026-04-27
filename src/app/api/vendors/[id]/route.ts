import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId

    const vendor = await prisma.vendor.findFirst({
      where: { id: id, organizationId },
      include: {
        workOrders: {
          include: {
            ticket: {
              select: {
                id: true,
                ticketNo: true,
                title: true,
                status: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        maintenanceTickets: {
          select: {
            id: true,
            ticketNo: true,
            title: true,
            status: true,
            priority: true,
            submittedAt: true,
          },
          orderBy: { submittedAt: 'desc' },
        },
      },
    })

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    return NextResponse.json({
      ...vendor,
      categoriesList: vendor.categories
        ? vendor.categories.split(',').map((c: string) => c.trim()).filter(Boolean)
        : [],
    })
  } catch (error) {
    console.error('GET /api/vendors/[id] error:', error)
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

    const existing = await prisma.vendor.findFirst({
      where: { id: id, organizationId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    if (body.companyName !== undefined) updateData.companyName = body.companyName
    if (body.contactPerson !== undefined) updateData.contactPerson = body.contactPerson
    if (body.phone !== undefined) updateData.phone = body.phone
    if (body.landline !== undefined) updateData.landline = body.landline
    if (body.email !== undefined) updateData.email = body.email
    if (body.tradeLicenseNo !== undefined) updateData.tradeLicenseNo = body.tradeLicenseNo
    if (body.tradeLicenseExpiry !== undefined) updateData.tradeLicenseExpiry = body.tradeLicenseExpiry
    if (body.address !== undefined) updateData.address = body.address
    if (body.status !== undefined) updateData.status = body.status
    if (body.isPreferred !== undefined) updateData.isPreferred = body.isPreferred === true
    if (body.notes !== undefined) updateData.notes = body.notes

    if (body.categories !== undefined) {
      if (Array.isArray(body.categories)) {
        updateData.categories = body.categories.join(', ')
      } else {
        updateData.categories = body.categories
      }
    }

    if (body.paymentMethods !== undefined) {
      const allowed = ['Cash', 'Cheque', 'BankTransfer']
      let pm = ''
      if (Array.isArray(body.paymentMethods)) {
        pm = body.paymentMethods.filter((m: string) => allowed.includes(m)).join(',')
      } else if (typeof body.paymentMethods === 'string') {
        pm = body.paymentMethods.split(',').map((s: string) => s.trim()).filter((m: string) => allowed.includes(m)).join(',')
      }
      if (!pm) {
        return NextResponse.json(
          { error: 'At least one accepted payment method is required (Cash / Cheque / BankTransfer).' },
          { status: 400 }
        )
      }
      updateData.paymentMethods = pm
    }

    const vendor = await prisma.vendor.update({
      where: { id },
      data: updateData,
    })

    await logActivity(
      organizationId,
      session.user.name,
      'Updated Vendor',
      `Vendor "${vendor.companyName}" updated`
    )

    return NextResponse.json({
      ...vendor,
      categoriesList: vendor.categories
        ? vendor.categories.split(',').map((c: string) => c.trim()).filter(Boolean)
        : [],
    })
  } catch (error) {
    console.error('PUT /api/vendors/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId

    const vendor = await prisma.vendor.findFirst({
      where: { id: id, organizationId },
    })

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    // Check for active work orders
    const activeWorkOrders = await prisma.workOrder.count({
      where: {
        vendorId: id,
        status: { in: ['Issued', 'In Progress'] },
      },
    })

    if (activeWorkOrders > 0) {
      return NextResponse.json(
        { error: `Cannot delete vendor with ${activeWorkOrders} active work order(s). Complete or cancel them first.` },
        { status: 400 }
      )
    }

    await prisma.vendor.delete({
      where: { id },
    })

    await logActivity(
      organizationId,
      session.user.name,
      'Deleted Vendor',
      `Vendor "${vendor.companyName}" deleted`
    )

    return NextResponse.json({ message: 'Vendor deleted successfully' })
  } catch (error) {
    console.error('DELETE /api/vendors/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
