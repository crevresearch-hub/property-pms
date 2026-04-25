import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// Lightweight list of tenancy contracts for the cheque/cash tracker.
// Returns just enough to derive Security Deposit + Admin/Ejari payment rows
// from the JSON-encoded notes (DEPOSIT_JSON / FEES_JSON / UPFRONT_JSON).
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const organizationId = session.user.organizationId
    const contracts = await prisma.tenancyContract.findMany({
      where: { organizationId },
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        tenantId: true,
        unitId: true,
        contractNo: true,
        version: true,
        status: true,
        contractType: true,
        rentAmount: true,
        securityDeposit: true,
        ejariFee: true,
        commissionFee: true,
        notes: true,
      },
    })
    return NextResponse.json({ contracts })
  } catch (error) {
    console.error('GET /api/tenancy-contracts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
