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
      usage,
      expectedMoveIn,
      preBookingDeposit,
      notes,
    } = body

    const baseDeposit = parseFloat(preBookingDeposit) || 0
    const isCommercial = usage === 'Commercial'
    const vat = isCommercial ? +(baseDeposit * 0.05).toFixed(2) : 0
    const totalDeposit = +(baseDeposit + vat).toFixed(2)

    if (!name?.trim() || !phone?.trim()) {
      return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 })
    }

    // Validate unit if provided
    let unit = null
    if (unitId) {
      unit = await prisma.unit.findFirst({ where: { id: unitId, organizationId } })
      if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
    }

    const combinedNotes = [
      `Usage: ${usage || 'Residential'}`,
      isCommercial && `Base deposit: AED ${baseDeposit}`,
      isCommercial && `VAT (5%): AED ${vat}`,
      isCommercial && `Total deposit (incl. VAT): AED ${totalDeposit}`,
      notes,
    ].filter(Boolean).join('\n')

    const tenant = await prisma.tenant.create({
      data: {
        organizationId,
        name: name.trim(),
        phone: phone.trim(),
        email: email?.trim() || '',
        status: 'Pre-Booked',
        preBookingDeposit: totalDeposit,  // stores total including VAT for commercial
        preBookingDate: new Date().toISOString().slice(0, 10),
        expectedMoveIn: expectedMoveIn || '',
        notes: combinedNotes,
      },
    })

    // Note: we do NOT change Unit.tenantId yet — the current tenant (if any) still occupies it.
    // We link via notes or a separate reservation concept.
    if (unit) {
      const reservationNote = `Pre-Booked: ${name} (${phone}) — ${usage || 'Residential'} — expects move-in ${expectedMoveIn || 'TBD'} — deposit AED ${totalDeposit}${isCommercial ? ' (incl. 5% VAT)' : ''}`
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
      `${name} pre-booked${unit ? ` unit ${unit.unitNo}` : ''} — ${usage || 'Residential'} — deposit AED ${totalDeposit}${isCommercial ? ` (base ${baseDeposit} + VAT ${vat})` : ''}`
    )

    return NextResponse.json({ tenant, unit: unit ? { id: unit.id, unitNo: unit.unitNo } : null }, { status: 201 })
  } catch (error) {
    console.error('POST /api/tenants/pre-booking error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
