import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

async function getNextInvoiceNumber(organizationId: string, currentMax: number): Promise<{ invoiceNo: string; nextNum: number }> {
  const year = new Date().getFullYear()
  const prefix = `INV-${year}-`
  const nextNum = currentMax + 1
  return {
    invoiceNo: `${prefix}${nextNum.toString().padStart(4, '0')}`,
    nextNum,
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

    const { dueDate, periodStart, periodEnd } = body

    if (!dueDate) {
      return NextResponse.json({ error: 'Due date is required' }, { status: 400 })
    }

    // Get all occupied units with tenants
    const occupiedUnits = await prisma.unit.findMany({
      where: {
        organizationId,
        status: 'Occupied',
        tenantId: { not: null },
        currentRent: { gt: 0 },
      },
      include: {
        tenant: {
          select: { id: true, name: true },
        },
      },
    })

    if (occupiedUnits.length === 0) {
      return NextResponse.json({ error: 'No occupied units with rent found' }, { status: 400 })
    }

    // Determine the starting invoice number
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

    let currentMax = 0
    if (lastInvoice) {
      const lastNum = parseInt(lastInvoice.invoiceNo.replace(prefix, ''), 10)
      if (!isNaN(lastNum)) {
        currentMax = lastNum
      }
    }

    // Create invoices for each occupied unit
    const invoices = []
    for (const unit of occupiedUnits) {
      const { invoiceNo, nextNum } = await getNextInvoiceNumber(organizationId, currentMax)
      currentMax = nextNum

      const invoice = await prisma.invoice.create({
        data: {
          organizationId,
          invoiceNo,
          tenantId: unit.tenantId!,
          unitId: unit.id,
          type: 'Rent',
          amount: unit.currentRent,
          vatAmount: 0,
          totalAmount: unit.currentRent,
          dueDate,
          periodStart: periodStart || '',
          periodEnd: periodEnd || '',
          status: 'Draft',
        },
        include: {
          tenant: { select: { id: true, name: true } },
          unit: { select: { id: true, unitNo: true } },
        },
      })

      invoices.push(invoice)
    }

    await logActivity(
      organizationId,
      session.user.name,
      'Bulk Generated Invoices',
      `Generated ${invoices.length} rent invoices for ${periodStart || dueDate}`
    )

    return NextResponse.json({
      message: `Successfully generated ${invoices.length} invoices`,
      count: invoices.length,
      invoices,
    }, { status: 201 })
  } catch (error) {
    console.error('POST /api/invoices/bulk-generate error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
