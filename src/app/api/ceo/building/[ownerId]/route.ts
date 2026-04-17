import { NextRequest, NextResponse } from 'next/server'
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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ownerId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const organizationId = session.user.organizationId
    const { ownerId } = await params

    const owner = await prisma.propertyOwner.findFirst({ where: { id: ownerId, organizationId } })
    if (!owner) return NextResponse.json({ error: 'Owner not found' }, { status: 404 })

    // Match units by BUILDING tag in notes
    const units = await prisma.unit.findMany({
      where: {
        organizationId,
        notes: { contains: `BUILDING:${owner.buildingName}` },
      },
      include: {
        tenant: { select: { id: true, name: true, email: true, phone: true, status: true } },
      },
      orderBy: { unitNo: 'asc' },
    })

    const tenantIds = units.map((u) => u.tenantId).filter((x): x is string => !!x)
    const [contracts, cheques, invoices, complaints, violations, tickets] = await Promise.all([
      prisma.tenancyContract.findMany({
        where: { organizationId, tenantId: { in: tenantIds } },
        orderBy: [{ version: 'desc' }],
      }),
      prisma.cheque.findMany({
        where: { organizationId, tenantId: { in: tenantIds } },
        orderBy: { chequeDate: 'asc' },
      }),
      prisma.invoice.findMany({
        where: { organizationId, tenantId: { in: tenantIds } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.complaint.findMany({
        where: { organizationId, tenantId: { in: tenantIds } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.violation.findMany({
        where: { organizationId, tenantId: { in: tenantIds } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.maintenanceTicket.findMany({
        where: { organizationId, tenantId: { in: tenantIds } },
        orderBy: { submittedAt: 'desc' },
        take: 10,
      }),
    ])

    // Per-unit aggregation
    const unitsView = units.map((u) => {
      const myContract = contracts.find((c) => c.tenantId === u.tenantId)
      const myCheques = cheques.filter((c) => c.tenantId === u.tenantId)
      const upfrontTotal = parseUpfrontTotal(myContract?.notes)
      const cleared = myCheques
        .filter((c) => c.status === 'Cleared' && !(c.sequenceNo === 1 && c.paymentType === 'Upfront'))
        .reduce((s, c) => s + (c.amount || 0), 0)
      const annualRent = myContract?.rentAmount || u.currentRent || 0
      const collected = upfrontTotal + cleared
      const pending = Math.max(0, annualRent - collected)
      return {
        id: u.id,
        unitNo: u.unitNo,
        unitType: u.unitType,
        status: u.status,
        contractEnd: u.contractEnd,
        annualRent,
        collected,
        pending,
        tenant: u.tenant,
        contractNo: myContract?.contractNo || null,
        contractStatus: myContract?.status || null,
      }
    })

    // Cheques by status
    const today = new Date().toISOString().slice(0, 10)
    const upcoming30 = new Date(); upcoming30.setDate(upcoming30.getDate() + 30)
    const upcoming30Str = upcoming30.toISOString().slice(0, 10)

    const chequeBuckets = {
      pendingAll: cheques.filter((c) => c.status === 'Received' || c.status === 'Pending' || c.status === 'Deposited').reduce((s, c) => s + (c.amount || 0), 0),
      dueNext30: cheques.filter((c) => (c.status === 'Received' || c.status === 'Pending' || c.status === 'Deposited') && c.chequeDate && c.chequeDate >= today && c.chequeDate <= upcoming30Str).reduce((s, c) => s + (c.amount || 0), 0),
      overdue: cheques.filter((c) => (c.status === 'Received' || c.status === 'Pending' || c.status === 'Deposited') && c.chequeDate && c.chequeDate < today).reduce((s, c) => s + (c.amount || 0), 0),
      cleared: cheques.filter((c) => c.status === 'Cleared').reduce((s, c) => s + (c.amount || 0), 0),
      bounced: cheques.filter((c) => c.status === 'Bounced').reduce((s, c) => s + (c.amount || 0), 0),
    }

    // Per-month inflow projection (next 12 months)
    const monthly: Record<string, { month: string; expected: number; cleared: number }> = {}
    const now = new Date()
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthly[key] = { month: d.toLocaleString('en-GB', { month: 'short', year: '2-digit' }), expected: 0, cleared: 0 }
    }
    for (const c of cheques) {
      if (!c.chequeDate) continue
      const k = c.chequeDate.slice(0, 7)
      if (monthly[k]) {
        if (c.status === 'Cleared') monthly[k].cleared += c.amount || 0
        else if (c.status !== 'Bounced' && c.status !== 'Replaced') monthly[k].expected += c.amount || 0
      }
    }
    const cashflowProjection = Object.values(monthly)

    // Building totals
    const annualRentRoll = unitsView.filter((u) => u.status === 'Occupied').reduce((s, u) => s + u.annualRent, 0)
    const totalCollected = unitsView.reduce((s, u) => s + u.collected, 0)
    const totalPending = unitsView.reduce((s, u) => s + u.pending, 0)
    const occupied = unitsView.filter((u) => u.status === 'Occupied').length
    const vacant = unitsView.filter((u) => u.status === 'Vacant').length
    const occupancyPct = unitsView.length > 0 ? Math.round((occupied / unitsView.length) * 100) : 0

    const totalInvoiced = invoices.reduce((s, i) => s + (i.totalAmount || 0), 0)
    const invoicePaid = invoices.reduce((s, i) => s + (i.paidAmount || 0), 0)

    return NextResponse.json({
      owner: {
        id: owner.id,
        ownerName: owner.ownerName,
        email: owner.email,
        phone: owner.phone,
        buildingName: owner.buildingName,
        area: owner.area,
        emirate: owner.emirate,
        plotNo: owner.plotNo,
        makaniNo: owner.makaniNo,
        totalUnits: owner.totalUnits,
        totalFloors: owner.totalFloors,
        serviceType: owner.serviceType,
      },
      totals: {
        units: unitsView.length,
        occupied,
        vacant,
        occupancyPct,
        annualRentRoll,
        collected: totalCollected,
        pending: totalPending,
        invoiced: totalInvoiced,
        invoicePaid,
        invoiceOutstanding: totalInvoiced - invoicePaid,
      },
      chequeBuckets,
      cashflowProjection,
      units: unitsView,
      cheques: cheques.map((c) => ({
        id: c.id,
        chequeNo: c.chequeNo,
        bankName: c.bankName,
        amount: c.amount,
        chequeDate: c.chequeDate,
        clearedDate: c.clearedDate,
        status: c.status,
        tenantName: units.find((u) => u.tenantId === c.tenantId)?.tenant?.name || '—',
        unitNo: units.find((u) => u.tenantId === c.tenantId)?.unitNo || '—',
      })),
      invoices: invoices.map((i) => ({
        id: i.id,
        invoiceNo: i.invoiceNo,
        type: i.type,
        totalAmount: i.totalAmount,
        paidAmount: i.paidAmount,
        status: i.status,
        dueDate: i.dueDate,
        tenantName: units.find((u) => u.tenantId === i.tenantId)?.tenant?.name || '—',
        unitNo: units.find((u) => u.tenantId === i.tenantId)?.unitNo || '—',
      })),
      complaints: complaints.map((c) => ({ id: c.id, complaintNo: c.complaintNo, subject: c.subject, status: c.status, createdAt: c.createdAt })),
      violations: violations.map((v) => ({ id: v.id, violationNo: v.violationNo, type: v.type, severity: v.severity, fineAmount: v.fineAmount, status: v.status, createdAt: v.createdAt })),
      tickets: tickets.map((t) => ({ id: t.id, ticketNo: t.ticketNo, title: t.title, priority: t.priority, status: t.status, submittedAt: t.submittedAt })),
      // Vacancy cost: avg rent of occupied × number of vacant units
      vacancyCost: vacant > 0 && occupied > 0 ? Math.round((annualRentRoll / occupied) * vacant) : 0,
      // Per-unit rent contribution (top contributors)
      topContributors: [...unitsView]
        .filter((u) => u.annualRent > 0)
        .sort((a, b) => b.annualRent - a.annualRent)
        .slice(0, 5)
        .map((u) => ({ unitNo: u.unitNo, tenantName: u.tenant?.name || 'Vacant', annualRent: u.annualRent })),
      // Maintenance cost rollup
      maintenanceCost: tickets.reduce((s, t) => s + ((t as { actualCost?: number }).actualCost || 0), 0),
      // Violations fines collected vs outstanding
      violationsRollup: {
        totalIssued: violations.reduce((s, v) => s + (v.fineAmount || 0), 0),
        paid: violations.filter((v) => v.status === 'Paid').reduce((s, v) => s + (v.fineAmount || 0), 0),
      },
    })
  } catch (error) {
    console.error('GET /api/ceo/building/[ownerId] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
