import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getOwnerSessionFromRequest } from '@/lib/owner-auth'

const UPFRONT_PREFIX = 'UPFRONT_JSON:'

export async function GET(request: NextRequest) {
  const session = getOwnerSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  try {
    const owner = await prisma.propertyOwner.findFirst({
      where: { id: session.id, organizationId: session.orgId },
    })
    if (!owner) return NextResponse.json({ error: 'Owner not found' }, { status: 404 })

    // Schema doesn't have a strict ownerId on units yet. We tag units in
    // .notes with "BUILDING:<name>" when seeding so the owner sees only
    // their building. Falls back to all org units if no tagged matches.
    let units = await prisma.unit.findMany({
      where: {
        organizationId: session.orgId,
        notes: { contains: `BUILDING:${owner.buildingName}` },
      },
      include: {
        tenant: { select: { id: true, name: true, email: true, status: true } },
      },
      orderBy: { unitNo: 'asc' },
    })
    if (units.length === 0) {
      units = await prisma.unit.findMany({
        where: { organizationId: session.orgId },
        include: {
          tenant: { select: { id: true, name: true, email: true, status: true } },
        },
        orderBy: { unitNo: 'asc' },
      })
    }

    const tenantIds = units.map((u) => u.tenantId).filter((x): x is string => !!x)
    const contracts = tenantIds.length
      ? await prisma.tenancyContract.findMany({
          where: { organizationId: session.orgId, tenantId: { in: tenantIds } },
          orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
        })
      : []
    const cheques = tenantIds.length
      ? await prisma.cheque.findMany({
          where: { organizationId: session.orgId, tenantId: { in: tenantIds } },
        })
      : []

    // Aggregate per unit
    const unitsView = units.map((u) => {
      const myContract = contracts.find((c) => c.tenantId === u.tenantId)
      const myCheques = cheques.filter((c) => c.tenantId === u.tenantId)
      let upfront = { cash: 0, chequeAmount: 0 }
      for (const line of (myContract?.notes || '').split('\n')) {
        if (line.startsWith(UPFRONT_PREFIX)) {
          try { upfront = { ...upfront, ...JSON.parse(line.slice(UPFRONT_PREFIX.length)) } } catch {}
        }
      }
      const upfrontTotal = upfront.cash + upfront.chequeAmount
      const cleared = myCheques
        .filter((c) => c.status === 'Cleared' && !(c.sequenceNo === 1 && c.paymentType === 'Upfront'))
        .reduce((s, c) => s + (c.amount || 0), 0)
      const annualRent = myContract?.rentAmount || u.currentRent || 0
      const totalCollected = upfrontTotal + cleared
      const pending = Math.max(0, annualRent - totalCollected)

      return {
        id: u.id,
        unitNo: u.unitNo,
        unitType: u.unitType,
        status: u.status,
        contractEnd: u.contractEnd,
        annualRent,
        totalCollected,
        pending,
        tenant: u.tenant,
        contract: myContract ? { id: myContract.id, contractNo: myContract.contractNo, status: myContract.status, contractStart: myContract.contractStart, contractEnd: myContract.contractEnd } : null,
      }
    })

    // Totals
    const totals = unitsView.reduce(
      (acc, u) => {
        acc.totalUnits += 1
        if (u.status === 'Occupied') acc.occupied += 1
        if (u.status === 'Vacant') acc.vacant += 1
        acc.annualRentRoll += u.annualRent
        acc.collected += u.totalCollected
        acc.pending += u.pending
        return acc
      },
      { totalUnits: 0, occupied: 0, vacant: 0, annualRentRoll: 0, collected: 0, pending: 0 }
    )

    return NextResponse.json({
      owner: {
        id: owner.id,
        name: owner.ownerName,
        email: owner.email,
        buildingName: owner.buildingName,
        area: owner.area,
        serviceType: owner.serviceType,
      },
      totals,
      units: unitsView,
    })
  } catch (error) {
    console.error('GET /api/owner/dashboard error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
