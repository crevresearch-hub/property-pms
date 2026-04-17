import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { createNotification } from '@/lib/notifications'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    const body = await request.json()

    const { tenantId, unitId, description, evidence, vehiclePlate } = body

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 })
    }

    // Verify tenant
    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId, organizationId },
    })
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    // Generate violation number
    const year = new Date().getFullYear()
    const count = await prisma.violation.count({
      where: {
        organizationId,
        violationNo: { startsWith: `VIO-${year}-` },
      },
    })
    const violationNo = `VIO-${year}-${String(count + 1).padStart(4, '0')}`

    const fineAmount = 200 // AED 200 for parking violation

    const violation = await prisma.violation.create({
      data: {
        organizationId,
        violationNo,
        tenantId,
        unitId: unitId || null,
        type: 'Parking Violation',
        description: description || `Parking violation reported${vehiclePlate ? ` - Vehicle: ${vehiclePlate}` : ''}`,
        evidence: evidence || '',
        severity: 'Warning',
        fineAmount,
        status: 'Issued',
        issuedBy: session.user.name,
        notes: vehiclePlate ? `Vehicle plate: ${vehiclePlate}` : '',
      },
      include: {
        tenant: { select: { id: true, name: true } },
        unit: { select: { id: true, unitNo: true } },
      },
    })

    // Notify tenant
    await createNotification(
      organizationId,
      'tenant',
      tenantId,
      `Parking Violation: ${violationNo}`,
      `You have been issued a parking violation with a fine of AED ${fineAmount}.`,
      'violation'
    )

    await logActivity(
      organizationId,
      session.user.name,
      'Reported Parking Violation',
      `${violationNo} issued to ${tenant.name} - AED ${fineAmount}`
    )

    return NextResponse.json(violation, { status: 201 })
  } catch (error) {
    console.error('POST /api/parking/violation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
