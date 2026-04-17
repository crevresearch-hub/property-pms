import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

const EID_REGEX = /^784-\d{4}-\d{7}-\d{1}$/

export async function POST(
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

    const existing = await prisma.tenant.findFirst({
      where: { id, organizationId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    const eidNumber = String(body.eidNumber || '').trim()
    if (!eidNumber || !EID_REGEX.test(eidNumber)) {
      return NextResponse.json(
        { error: 'Invalid Emirates ID format. Expected 784-YYYY-NNNNNNN-N' },
        { status: 400 }
      )
    }

    const eidNameEn = String(body.eidNameEn || '').trim()
    const eidNameAr = String(body.eidNameAr || '').trim()
    const eidExpiry = String(body.eidExpiry || '').trim()
    const eidIssued = String(body.eidIssued || '').trim()
    const eidCardNumber = String(body.eidCardNumber || '').trim()
    const eidDob = String(body.eidDob || '').trim()

    // Mismatch warnings (non-blocking — client chose to proceed)
    const warnings: string[] = []
    if (existing.name && eidNameEn && existing.name.trim().toLowerCase() !== eidNameEn.toLowerCase()) {
      warnings.push('Name on EID does not match tenant record')
    }
    if (existing.emiratesId && eidNumber && existing.emiratesId.trim() !== eidNumber) {
      warnings.push('Emirates ID number does not match tenant record')
    }

    const updateData: Record<string, unknown> = {
      eidNameEn,
      eidNameAr,
      eidNumber,
      eidExpiry,
      eidIssued,
      eidCardNumber,
      eidDob,
      eidVerifiedAt: new Date(),
      eidVerifiedBy: session.user.name || session.user.email || 'staff',
    }

    // Optionally sync canonical fields if caller asked us to
    if (body.syncToTenant) {
      if (eidNameEn) updateData.name = eidNameEn
      if (eidNumber) updateData.emiratesId = eidNumber
      if (eidExpiry) updateData.emiratesIdExpiry = eidExpiry
    }

    const tenant = await prisma.tenant.update({
      where: { id },
      data: updateData,
    })

    await logActivity(
      organizationId,
      session.user.name || 'staff',
      'Verified Emirates ID',
      `Tenant ${tenant.name} EID ${eidNumber} verified${warnings.length ? ' (with warnings)' : ''}`
    )

    return NextResponse.json({ tenant, warnings })
  } catch (error) {
    console.error('POST /api/tenants/[id]/eid-verify error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
