import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

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

    const existing = await prisma.dewaReading.findFirst({
      where: { id, organizationId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'DEWA reading not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    if (body.premiseNo !== undefined) updateData.premiseNo = body.premiseNo
    if (body.month !== undefined) updateData.month = body.month
    if (body.electricityReading !== undefined) updateData.electricityReading = parseFloat(body.electricityReading)
    if (body.waterReading !== undefined) updateData.waterReading = parseFloat(body.waterReading)
    if (body.electricityCharge !== undefined) updateData.electricityCharge = parseFloat(body.electricityCharge)
    if (body.waterCharge !== undefined) updateData.waterCharge = parseFloat(body.waterCharge)
    if (body.sewageCharge !== undefined) updateData.sewageCharge = parseFloat(body.sewageCharge)
    if (body.status !== undefined) updateData.status = body.status
    if (body.paidDate !== undefined) updateData.paidDate = body.paidDate
    if (body.notes !== undefined) updateData.notes = body.notes

    // Recalculate total if any charge changed
    const elecCharge = body.electricityCharge !== undefined
      ? parseFloat(body.electricityCharge)
      : existing.electricityCharge
    const watCharge = body.waterCharge !== undefined
      ? parseFloat(body.waterCharge)
      : existing.waterCharge
    const sewCharge = body.sewageCharge !== undefined
      ? parseFloat(body.sewageCharge)
      : existing.sewageCharge
    updateData.totalCharge = elecCharge + watCharge + sewCharge

    const reading = await prisma.dewaReading.update({
      where: { id },
      data: updateData,
      include: {
        unit: { select: { id: true, unitNo: true } },
        tenant: { select: { id: true, name: true } },
      },
    })

    await logActivity(
      organizationId,
      session.user.name,
      'Updated DEWA Reading',
      `Reading for ${reading.month} updated - Total: AED ${reading.totalCharge.toFixed(2)}`
    )

    return NextResponse.json(reading)
  } catch (error) {
    console.error('PUT /api/dewa/[id] error:', error)
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

    const existing = await prisma.dewaReading.findFirst({
      where: { id, organizationId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'DEWA reading not found' }, { status: 404 })
    }

    await prisma.dewaReading.delete({ where: { id } })

    await logActivity(
      organizationId,
      session.user.name,
      'Deleted DEWA Reading',
      `Reading for ${existing.month} deleted`
    )

    return NextResponse.json({ message: 'DEWA reading deleted' })
  } catch (error) {
    console.error('DELETE /api/dewa/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
