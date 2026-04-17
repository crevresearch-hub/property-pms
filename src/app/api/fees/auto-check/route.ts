import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { calculateFee } from '@/lib/fees'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    const today = new Date().toISOString().split('T')[0]

    // Find units with expired contracts that don't already have a late renewal fee
    const units = await prisma.unit.findMany({
      where: {
        organizationId,
        status: 'Occupied',
        contractEnd: { not: '', lt: today },
        tenantId: { not: null },
      },
      include: {
        tenant: { select: { id: true, name: true } },
      },
    })

    const created: string[] = []

    for (const unit of units) {
      if (!unit.tenantId) continue

      // Check if late fee already exists for this unit
      const existingFee = await prisma.feeLedger.findFirst({
        where: {
          organizationId,
          unitId: unit.id,
          feeType: { startsWith: 'Late Renewal' },
          status: 'Pending',
        },
      })

      if (existingFee) continue

      // Calculate days expired
      const contractEnd = new Date(unit.contractEnd)
      const now = new Date()
      const daysExpired = Math.floor(
        (now.getTime() - contractEnd.getTime()) / (1000 * 60 * 60 * 24)
      )

      let feeKey: string
      let feeType: string

      if (daysExpired <= 15) {
        feeKey = 'late_renewal_15'
        feeType = 'Late Renewal (within 15 days)'
      } else {
        feeKey = 'late_renewal_30'
        feeType = 'Late Renewal (within 30 days)'
      }

      const amount = calculateFee(feeKey, unit.currentRent)

      await prisma.feeLedger.create({
        data: {
          organizationId,
          tenantId: unit.tenantId,
          unitId: unit.id,
          feeType,
          description: `Auto-generated: Contract expired ${unit.contractEnd}, ${daysExpired} days overdue`,
          amount,
          beneficiary: 'CRE',
          status: 'Pending',
        },
      })

      created.push(`${unit.unitNo} - ${unit.tenant?.name || 'Unknown'} - AED ${amount}`)
    }

    await logActivity(
      organizationId,
      session.user.name,
      'Auto-Check Late Renewals',
      `Created ${created.length} late renewal fees`
    )

    return NextResponse.json({
      message: `Scanned ${units.length} expired contracts, created ${created.length} late renewal fees`,
      scanned: units.length,
      fees_created: created.length,
      details: created,
    })
  } catch (error) {
    console.error('POST /api/fees/auto-check error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
