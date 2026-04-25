import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { buildVatInvoiceHTML } from '@/lib/vat-invoice-html'

export async function GET(
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
    const url = new URL(request.url)
    const format = url.searchParams.get('format')

    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            emiratesId: true,
          },
        },
        unit: {
          select: {
            id: true,
            unitNo: true,
            unitType: true,
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    if (format === 'html') {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true, address: true, logo: true, phone: true, email: true },
      })
      // Look up owner via the latest tenancy contract for this unit
      const tc = invoice.unitId
        ? await prisma.tenancyContract.findFirst({
            where: { organizationId, unitId: invoice.unitId },
            orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
            select: { ownerId: true },
          })
        : null
      const owner = tc?.ownerId
        ? await prisma.propertyOwner.findUnique({
            where: { id: tc.ownerId },
            select: { ownerName: true, buildingName: true, address: true, iban: true, bankName: true, email: true, phone: true, tradeLicense: true },
          })
        : null
      const html = buildVatInvoiceHTML({
        invoice: { ...invoice, notes: invoice.notes || '' },
        tenant: {
          name: invoice.tenant?.name || '',
          email: invoice.tenant?.email || undefined,
          phone: invoice.tenant?.phone || undefined,
          emiratesId: invoice.tenant?.emiratesId || undefined,
        },
        unit: {
          unitNo: invoice.unit?.unitNo || '',
          unitType: invoice.unit?.unitType || undefined,
        },
        owner: owner || null,
        organization: {
          name: org?.name || 'Alwaan',
          address: org?.address,
          logo: org?.logo,
          phone: org?.phone,
          email: org?.email,
        },
      })
      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    return NextResponse.json(invoice)
  } catch (error) {
    console.error('GET /api/invoices/[id] error:', error)
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

    const existing = await prisma.invoice.findFirst({
      where: { id, organizationId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    if (body.tenantId !== undefined) updateData.tenantId = body.tenantId || null
    if (body.unitId !== undefined) updateData.unitId = body.unitId || null
    if (body.type !== undefined) updateData.type = body.type
    if (body.dueDate !== undefined) updateData.dueDate = body.dueDate
    if (body.periodStart !== undefined) updateData.periodStart = body.periodStart
    if (body.periodEnd !== undefined) updateData.periodEnd = body.periodEnd
    if (body.status !== undefined) updateData.status = body.status
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.lateFee !== undefined) updateData.lateFee = parseFloat(body.lateFee)

    if (body.amount !== undefined || body.vatAmount !== undefined) {
      const newAmount = body.amount !== undefined ? parseFloat(body.amount) : existing.amount
      const newVat = body.vatAmount !== undefined ? parseFloat(body.vatAmount) : existing.vatAmount
      updateData.amount = newAmount
      updateData.vatAmount = newVat
      updateData.totalAmount = newAmount + newVat
    }

    const invoice = await prisma.invoice.update({
      where: { id },
      data: updateData,
      include: {
        tenant: {
          select: { id: true, name: true },
        },
        unit: {
          select: { id: true, unitNo: true },
        },
        payments: true,
      },
    })

    await logActivity(organizationId, session.user.name, 'Updated Invoice', `Invoice ${invoice.invoiceNo} updated`)

    return NextResponse.json(invoice)
  } catch (error) {
    console.error('PUT /api/invoices/[id] error:', error)
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

    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    if (invoice.status !== 'Draft') {
      return NextResponse.json(
        { error: 'Only Draft invoices can be deleted' },
        { status: 400 }
      )
    }

    await prisma.invoice.delete({
      where: { id },
    })

    await logActivity(organizationId, session.user.name, 'Deleted Invoice', `Invoice ${invoice.invoiceNo} deleted`)

    return NextResponse.json({ message: 'Invoice deleted successfully' })
  } catch (error) {
    console.error('DELETE /api/invoices/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
