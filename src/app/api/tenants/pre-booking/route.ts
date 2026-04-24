import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const organizationId = session.user.organizationId
    const body = await request.json()
    const {
      name,
      phone,
      email,
      unitId,
      expectedMoveIn,
      preBookingDeposit,
      notes,
    } = body

    if (!name?.trim() || !phone?.trim()) {
      return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 })
    }

    // Validate unit if provided
    let unit = null
    if (unitId) {
      unit = await prisma.unit.findFirst({ where: { id: unitId, organizationId } })
      if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
    }

    const tenant = await prisma.tenant.create({
      data: {
        organizationId,
        name: name.trim(),
        phone: phone.trim(),
        email: email?.trim() || '',
        status: 'Pre-Booked',
        preBookingDeposit: parseFloat(preBookingDeposit) || 0,
        preBookingDate: new Date().toISOString().slice(0, 10),
        expectedMoveIn: expectedMoveIn || '',
        notes: notes || '',
      },
    })

    // Note: we do NOT change Unit.tenantId yet — the current tenant (if any) still occupies it.
    // We link via notes or a separate reservation concept.
    if (unit) {
      const reservationNote = `Pre-Booked: ${name} (${phone}) — expects move-in ${expectedMoveIn || 'TBD'} — deposit AED ${preBookingDeposit || 0}`
      await prisma.unit.update({
        where: { id: unit.id },
        data: {
          notes: unit.notes ? `${unit.notes}\n${reservationNote}` : reservationNote,
        },
      })
    }

    await logActivity(
      organizationId,
      session.user.name,
      'Pre-Booking Created',
      `${name} pre-booked${unit ? ` unit ${unit.unitNo}` : ''} — deposit AED ${preBookingDeposit || 0}`
    )

    return NextResponse.json({ tenant, unit: unit ? { id: unit.id, unitNo: unit.unitNo } : null }, { status: 201 })
  } catch (error) {
    console.error('POST /api/tenants/pre-booking error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
