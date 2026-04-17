import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

const UPFRONT_PREFIX = 'UPFRONT_JSON:'
function parseUpfrontTotal(notes: string | undefined | null): number {
  if (!notes) return 0
  for (const line of notes.split('\n')) {
    if (line.startsWith(UPFRONT_PREFIX)) {
      try {
        const u = JSON.parse(line.slice(UPFRONT_PREFIX.length))
        return (u.cash || 0) + (u.chequeAmount || 0)
      } catch { /* ignore */ }
    }
  }
  return 0
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const organizationId = session.user.organizationId

    const [owners, units, contracts, cheques, invoices] = await Promise.all([
      prisma.propertyOwner.findMany({ where: { organizationId } }),
      prisma.unit.findMany({
        where: { organizationId },
        include: { tenant: { select: { id: true, name: true } } },
      }),
      prisma.tenancyContract.findMany({ where: { organizationId } }),
      prisma.cheque.findMany({ where: { organizationId } }),
      prisma.invoice.findMany({ where: { organizationId } }),
    ])

    const matchUnitsToOwner = (ownerName: string, buildingName: string) =>
      units.filter(
        (u) =>
          (u.notes || '').includes(`BUILDING:${buildingName}`) ||
          // Fallback: if a unit is unassigned and there's just one owner, attribute it.
          (units.every((x) => !(x.notes || '').includes('BUILDING:')) && owners.length === 1)
      )

    const buildings = owners.map((o) => {
      const myUnits = matchUnitsToOwner(o.ownerName, o.buildingName)
      const myTenantIds = myUnits.map((u) => u.tenantId).filter((x): x is string => !!x)
      const myContracts = contracts.filter((c) => myTenantIds.includes(c.tenantId))
      const myCheques = cheques.filter((c) => myTenantIds.includes(c.tenantId))
      const myInvoices = invoices.filter((i) => i.tenantId && myTenantIds.includes(i.tenantId))

      const occupied = myUnits.filter((u) => u.status === 'Occupied').length
      const vacant = myUnits.filter((u) => u.status === 'Vacant').length
      const annualRentRoll = myUnits
        .filter((u) => u.status === 'Occupied')
        .reduce((s, u) => s + (u.currentRent || 0), 0)

      const upfront = myContracts.reduce((s, c) => s + parseUpfrontTotal(c.notes), 0)
      const cleared = myCheques
        .filter((c) => c.status === 'Cleared' && !(c.sequenceNo === 1 && c.paymentType === 'Upfront'))
        .reduce((s, c) => s + (c.amount || 0), 0)
      const pdcsInHand = myCheques
        .filter((c) => !!c.chequeNo && c.status !== 'Cleared' && c.status !== 'Bounced')
        .reduce((s, c) => s + (c.amount || 0), 0)
      const invoicesPaid = myInvoices.reduce((s, i) => s + (i.paidAmount || 0), 0)
      const collected = upfront + cleared + invoicesPaid
      const pending = Math.max(0, annualRentRoll - collected)
      const occupancyPct = myUnits.length > 0 ? Math.round((occupied / myUnits.length) * 100) : 0

      return {
        ownerId: o.id,
        ownerName: o.ownerName,
        ownerEmail: o.email,
        buildingName: o.buildingName,
        area: o.area,
        totalUnits: myUnits.length,
        occupied,
        vacant,
        occupancyPct,
        annualRentRoll,
        collected,
        pdcsInHand,
        pending,
      }
    })

    const portfolio = buildings.reduce(
      (acc, b) => {
        acc.totalUnits += b.totalUnits
        acc.occupied += b.occupied
        acc.vacant += b.vacant
        acc.annualRentRoll += b.annualRentRoll
        acc.collected += b.collected
        acc.pdcsInHand += b.pdcsInHand
        acc.pending += b.pending
        return acc
      },
      { totalUnits: 0, occupied: 0, vacant: 0, annualRentRoll: 0, collected: 0, pdcsInHand: 0, pending: 0 }
    )
    const portfolioOccupancyPct = portfolio.totalUnits > 0 ? Math.round((portfolio.occupied / portfolio.totalUnits) * 100) : 0

    // Top tenants by rent
    const occupiedUnits = units.filter((u) => u.tenant)
    const topTenants = [...occupiedUnits]
      .sort((a, b) => (b.currentRent || 0) - (a.currentRent || 0))
      .slice(0, 5)
      .map((u) => ({
        unitNo: u.unitNo,
        tenantName: u.tenant?.name || '—',
        annualRent: u.currentRent || 0,
      }))

    return NextResponse.json({
      portfolio: { ...portfolio, occupancyPct: portfolioOccupancyPct, totalOwners: owners.length, totalBuildings: owners.length },
      buildings: buildings.sort((a, b) => b.annualRentRoll - a.annualRentRoll),
      topTenants,
    })
  } catch (error) {
    console.error('GET /api/ceo/summary error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
