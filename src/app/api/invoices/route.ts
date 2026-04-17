import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

async function generateInvoiceNo(organizationId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `INV-${year}-`

  const lastInvoice = await prisma.invoice.findFirst({
    where: {
      organizationId,
      invoiceNo: { startsWith: prefix },
    },
    orderBy: { invoiceNo: 'desc' },
    select: { invoiceNo: true },
  })

  let nextNum = 1
  if (lastInvoice) {
    const lastNum = parseInt(lastInvoice.invoiceNo.replace(prefix, ''), 10)
    if (!isNaN(lastNum)) {
      nextNum = lastNum + 1
    }
  }

  return `${prefix}${nextNum.toString().padStart(4, '0')}`
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status')
    const tenantIdFilter = searchParams.get('tenant_id')

    // Auto-overdue: update Sent invoices past due_date to Overdue
    const today = new Date().toISOString().split('T')[0]
    await prisma.invoice.updateMany({
      where: {
        organizationId,
        status: 'Sent',
        dueDate: { lt: today },
      },
      data: { status: 'Overdue' },
    })

    const where: Record<string, unknown> = { organizationId }
    if (statusFilter) {
      where.status = statusFilter
    }
    if (tenantIdFilter) {
      where.tenantId = tenantIdFilter
    }

    const invoices = await prisma.invoice.findMany({
      where,
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
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(invoices)
  } catch (error) {
    console.error('GET /api/invoices error:', error)
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

    const { tenantId, unitId, type, amount, vatAmount, dueDate, periodStart, periodEnd, notes } = body

    if (!amount || !dueDate) {
      return NextResponse.json({ error: 'Amount and due date are required' }, { status: 400 })
    }

    const parsedAmount = parseFloat(amount)
    const parsedVat = vatAmount ? parseFloat(vatAmount) : 0
    const totalAmount = parsedAmount + parsedVat

    // Validate tenant belongs to org if provided
    if (tenantId) {
      const tenant = await prisma.tenant.findFirst({
        where: { id: tenantId, organizationId },
      })
      if (!tenant) {
        return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
      }
    }

    // Validate unit belongs to org if provided
    if (unitId) {
      const unit = await prisma.unit.findFirst({
        where: { id: unitId, organizationId },
      })
      if (!unit) {
        return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
      }
    }

    const invoiceNo = await generateInvoiceNo(organizationId)

    const invoice = await prisma.invoice.create({
      data: {
        organizationId,
        invoiceNo,
        tenantId: tenantId || null,
        unitId: unitId || null,
        type: type || 'Rent',
        amount: parsedAmount,
        vatAmount: parsedVat,
        totalAmount,
        dueDate,
        periodStart: periodStart || '',
        periodEnd: periodEnd || '',
        status: 'Draft',
        notes: notes || '',
      },
      include: {
        tenant: {
          select: { id: true, name: true },
        },
        unit: {
          select: { id: true, unitNo: true },
        },
      },
    })

    await logActivity(organizationId, session.user.name, 'Created Invoice', `Invoice ${invoiceNo} created`)

    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    console.error('POST /api/invoices error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
