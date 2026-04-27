import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getOwnerSession } from '@/lib/owner-auth'

// GET — list vendor bills for the logged-in owner. Optional ?status=...
// Owners only see bills attributed to them (bill.ownerId === their id).
export async function GET(request: NextRequest) {
  try {
    const session = getOwnerSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined

    const where: Record<string, unknown> = {
      organizationId: session.orgId,
      ownerId: session.id,
    }
    if (status) where.status = status

    const bills = await prisma.vendorBill.findMany({
      where,
      include: {
        vendor: { select: { id: true, companyName: true, phone: true, email: true } },
        unit: { select: { id: true, unitNo: true } },
        tenant: { select: { id: true, name: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json(bills)
  } catch (error) {
    console.error('GET /api/owner/vendor-bills error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
