import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

export async function POST(
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

    const invoice = await prisma.invoice.findFirst({
      where: { id: id, organizationId },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    if (invoice.status === 'Paid') {
      return NextResponse.json(
        { error: 'Paid invoices cannot be cancelled' },
        { status: 400 }
      )
    }

    if (invoice.status === 'Cancelled') {
      return NextResponse.json(
        { error: 'Invoice is already cancelled' },
        { status: 400 }
      )
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: { status: 'Cancelled' },
      include: {
        tenant: { select: { id: true, name: true } },
        unit: { select: { id: true, unitNo: true } },
      },
    })

    await logActivity(
      organizationId,
      session.user.name,
      'Cancelled Invoice',
      `Invoice ${invoice.invoiceNo} cancelled`
    )

    return NextResponse.json(updated)
  } catch (error) {
    console.error('POST /api/invoices/[id]/cancel error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
