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

    // Calculate 90-day window
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const ninetyDaysLater = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000)
    const ninetyDaysStr = ninetyDaysLater.toISOString().split('T')[0]

    // Get all occupied units with contract end dates
    const units = await prisma.unit.findMany({
      where: {
        organizationId,
        status: 'Occupied',
        contractEnd: {
          not: '',
        },
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
      },
      orderBy: { contractEnd: 'asc' },
    })

    type UnitWithTenant = typeof units[number]

    // Filter units expiring within 90 days (contractEnd is stored as string YYYY-MM-DD)
    const expiringUnits = units.filter((u: UnitWithTenant) => {
      return u.contractEnd >= todayStr && u.contractEnd <= ninetyDaysStr
    })

    // Also find already-expired units still marked as occupied
    const expiredUnits = units.filter((u: UnitWithTenant) => {
      return u.contractEnd < todayStr
    })

    // Get existing renewal requests for these units
    const unitIds = [...expiringUnits, ...expiredUnits].map((u: UnitWithTenant) => u.id)

    // Pull renewal requests for ALL units (not just expiring) so stable units
    // also show their renewal history.
    const allUnitIds = units.map((u) => u.id)
    const renewalRequests = await prisma.renewalRequest.findMany({
      where: {
        organizationId,
        unitId: { in: allUnitIds },
      },
      select: {
        id: true,
        unitId: true,
        status: true,
        proposedRent: true,
        finalRent: true,
        requestedAt: true,
      },
      orderBy: { requestedAt: 'desc' },
    })
    void unitIds

    const renewalMap = new Map<string, typeof renewalRequests[0]>()
    for (const r of renewalRequests) {
      // Keep the most recent one per unit
      const existing = renewalMap.get(r.unitId)
      if (!existing || r.requestedAt > existing.requestedAt) {
        renewalMap.set(r.unitId, r)
      }
    }

    // Pull recent renewal-related email activity (last 30 days) per tenant so
    // the dashboard can show what's been sent (Reminder, Congrats, etc.).
    const tenantIdsForLogs = units.map((u) => u.tenantId).filter((x): x is string => !!x)
    const recentLogs = tenantIdsForLogs.length
      ? await prisma.emailLog.findMany({
          where: {
            organizationId,
            refType: 'tenant',
            refId: { in: tenantIdsForLogs },
            template: { startsWith: 'renewal_' },
            sentAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
          orderBy: { sentAt: 'desc' },
          select: { template: true, sentAt: true, refId: true, status: true, subject: true },
        })
      : []
    const logsByTenant = new Map<string, typeof recentLogs>()
    for (const l of recentLogs) {
      const arr = logsByTenant.get(l.refId) || []
      arr.push(l)
      logsByTenant.set(l.refId, arr)
    }

    const formatAlert = (unit: typeof units[0], category: string) => {
      const daysLeft = Math.ceil(
        (new Date(unit.contractEnd).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      )
      const renewal = renewalMap.get(unit.id)
      const tenantLogs = unit.tenantId ? (logsByTenant.get(unit.tenantId) || []) : []

      return {
        unitId: unit.id,
        unitNo: unit.unitNo,
        unitType: unit.unitType,
        contractEnd: unit.contractEnd,
        currentRent: unit.currentRent,
        daysUntilExpiry: daysLeft,
        category,
        tenant: unit.tenant,
        renewalStatus: renewal ? renewal.status : 'No Renewal Started',
        renewalId: renewal ? renewal.id : null,
        renewalRequest: renewal
          ? {
              id: renewal.id,
              status: renewal.status,
              proposedRent: renewal.proposedRent,
              finalRent: renewal.finalRent,
              requestedAt: renewal.requestedAt,
            }
          : null,
        recentActivity: tenantLogs.slice(0, 4).map((l) => ({
          template: l.template,
          subject: l.subject,
          sentAt: l.sentAt,
          status: l.status,
        })),
      }
    }

    // Stable units = active leases more than 90 days from expiry. Included
    // so the dashboard can show every apartment, not just the urgent ones.
    const stableUnits = units.filter((u: UnitWithTenant) => {
      return u.contractEnd > ninetyDaysStr
    })

    const alerts = [
      ...expiredUnits.map((u: UnitWithTenant) => formatAlert(u, 'Expired')),
      ...expiringUnits
        .filter((u: UnitWithTenant) => {
          const days = Math.ceil(
            (new Date(u.contractEnd).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          )
          return days <= 30
        })
        .map((u: UnitWithTenant) => formatAlert(u, 'Critical (within 30 days)')),
      ...expiringUnits
        .filter((u: UnitWithTenant) => {
          const days = Math.ceil(
            (new Date(u.contractEnd).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          )
          return days > 30 && days <= 60
        })
        .map((u: UnitWithTenant) => formatAlert(u, 'Warning (within 60 days)')),
      ...expiringUnits
        .filter((u: UnitWithTenant) => {
          const days = Math.ceil(
            (new Date(u.contractEnd).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          )
          return days > 60
        })
        .map((u: UnitWithTenant) => formatAlert(u, 'Upcoming (within 90 days)')),
      ...stableUnits.map((u: UnitWithTenant) => formatAlert(u, 'Stable (90+ days)')),
    ]

    return NextResponse.json({
      totalExpiring: expiringUnits.length,
      totalExpired: expiredUnits.length,
      totalStable: stableUnits.length,
      alerts,
    })
  } catch (error) {
    console.error('GET /api/renewals/expiry-alerts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
