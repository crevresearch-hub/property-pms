import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId

    const violations = await prisma.violation.findMany({
      where: { organizationId },
      select: {
        status: true,
        type: true,
        fineAmount: true,
        tenantId: true,
        tenant: { select: { name: true } },
      },
    })

    type ViolationRow = { status: string; type: string; fineAmount: number; tenantId: string; tenant: { name: string } | null }
    const total = violations.length
    const issued = violations.filter((v: ViolationRow) => v.status === 'Issued').length
    const acknowledged = violations.filter((v: ViolationRow) => v.status === 'Acknowledged').length
    const paid = violations.filter((v: ViolationRow) => v.status === 'Paid').length

    const total_fines = violations.reduce((sum: number, v: ViolationRow) => sum + v.fineAmount, 0)
    const paid_fines = violations
      .filter((v: ViolationRow) => v.status === 'Paid')
      .reduce((sum: number, v: ViolationRow) => sum + v.fineAmount, 0)
    const unpaid_fines = total_fines - paid_fines

    // Repeat offenders: tenants with 3+ violations
    const tenantCounts: Record<string, { count: number; name: string }> = {}
    for (const v of violations) {
      if (!tenantCounts[v.tenantId]) {
        tenantCounts[v.tenantId] = { count: 0, name: v.tenant?.name || 'Unknown' }
      }
      tenantCounts[v.tenantId].count++
    }
    const repeat_offenders = Object.entries(tenantCounts)
      .filter(([, data]) => data.count >= 3)
      .map(([tenantId, data]) => ({
        tenantId,
        name: data.name,
        violationCount: data.count,
      }))

    // By type breakdown
    const by_type: Record<string, number> = {}
    for (const v of violations) {
      by_type[v.type] = (by_type[v.type] || 0) + 1
    }

    return NextResponse.json({
      total,
      issued,
      acknowledged,
      paid,
      total_fines,
      paid_fines,
      unpaid_fines,
      repeat_offenders,
      by_type,
    })
  } catch (error) {
    console.error('GET /api/violations/stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
