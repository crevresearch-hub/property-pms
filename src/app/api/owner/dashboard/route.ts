import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getOwnerSession } from '@/lib/owner-auth'

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

export async function GET(request: NextRequest) {
  try {
    const session = getOwnerSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const owner = await prisma.propertyOwner.findFirst({
      where: { id: session.id, organizationId: session.orgId },
    })
    if (!owner) return NextResponse.json({ error: 'Owner not found' }, { status: 404 })

    const units = await prisma.unit.findMany({
      where: {
        organizationId: owner.organizationId,
        ...(owner.buildingName ? { notes: { contains: owner.buildingName, mode: 'insensitive' } } : {}),
      },
      include: {
        tenant: { select: { id: true, name: true, email: true, phone: true, nationality: true, status: true } },
      },
      orderBy: { unitNo: 'asc' },
    })

    const tenantIds = units.map((u) => u.tenantId).filter((x): x is string => !!x)
    const [contracts, cheques, invoices, complaints, tickets, violations] = await Promise.all([
      prisma.tenancyContract.findMany({
        where: { organizationId: owner.organizationId, tenantId: { in: tenantIds } },
        orderBy: [{ version: 'desc' }],
      }),
      prisma.cheque.findMany({
        where: { organizationId: owner.organizationId, tenantId: { in: tenantIds } },
        orderBy: { chequeDate: 'asc' },
      }),
      prisma.invoice.findMany({
        where: { organizationId: owner.organizationId, tenantId: { in: tenantIds } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.complaint.findMany({
        where: { organizationId: owner.organizationId, tenantId: { in: tenantIds } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.maintenanceTicket.findMany({
        where: { organizationId: owner.organizationId, tenantId: { in: tenantIds } },
        orderBy: { submittedAt: 'desc' },
      }),
      prisma.violation.findMany({
        where: { organizationId: owner.organizationId, tenantId: { in: tenantIds } },
        orderBy: { createdAt: 'desc' },
      }),
    ])

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
        sqFt: u.sqFt,
        status: u.status,
        contractStart: u.contractStart,
        contractEnd: u.contractEnd,
        annualRent,
        collected,
        pending,
        rentPerSqft: u.sqFt > 0 ? annualRent / u.sqFt : 0,
        tenant: u.tenant,
      }
    })

    const today = new Date().toISOString().slice(0, 10)
    const upcoming30 = new Date()
    upcoming30.setDate(upcoming30.getDate() + 30)
    const upcoming30Str = upcoming30.toISOString().slice(0, 10)
    const upcoming90 = new Date()
    upcoming90.setDate(upcoming90.getDate() + 90)
    const upcoming90Str = upcoming90.toISOString().slice(0, 10)

    const chequeBuckets = {
      pendingAll: cheques.filter((c) => ['Received', 'Pending', 'Deposited'].includes(c.status)).reduce((s, c) => s + (c.amount || 0), 0),
      dueNext30: cheques.filter((c) => ['Received', 'Pending', 'Deposited'].includes(c.status) && c.chequeDate && c.chequeDate >= today && c.chequeDate <= upcoming30Str).reduce((s, c) => s + (c.amount || 0), 0),
      dueNext90: cheques.filter((c) => ['Received', 'Pending', 'Deposited'].includes(c.status) && c.chequeDate && c.chequeDate >= today && c.chequeDate <= upcoming90Str).reduce((s, c) => s + (c.amount || 0), 0),
      overdue: cheques.filter((c) => ['Received', 'Pending', 'Deposited'].includes(c.status) && c.chequeDate && c.chequeDate < today).reduce((s, c) => s + (c.amount || 0), 0),
      cleared: cheques.filter((c) => c.status === 'Cleared').reduce((s, c) => s + (c.amount || 0), 0),
      bounced: cheques.filter((c) => c.status === 'Bounced').reduce((s, c) => s + (c.amount || 0), 0),
      total: cheques.length,
    }

    // Monthly projection (24 months backward + forward)
    const monthly: Record<string, { key: string; month: string; expected: number; cleared: number; bounced: number }> = {}
    const now = new Date()
    for (let i = -6; i < 18; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthly[key] = {
        key,
        month: d.toLocaleString('en-GB', { month: 'short', year: '2-digit' }),
        expected: 0,
        cleared: 0,
        bounced: 0,
      }
    }
    for (const c of cheques) {
      if (!c.chequeDate) continue
      const k = c.chequeDate.slice(0, 7)
      if (monthly[k]) {
        if (c.status === 'Cleared') monthly[k].cleared += c.amount || 0
        else if (c.status === 'Bounced') monthly[k].bounced += c.amount || 0
        else if (c.status !== 'Replaced') monthly[k].expected += c.amount || 0
      }
    }

    // Unit type distribution
    const typeMap: Record<string, { count: number; rent: number; sqft: number }> = {}
    for (const u of unitsView) {
      const t = u.unitType || 'Unknown'
      if (!typeMap[t]) typeMap[t] = { count: 0, rent: 0, sqft: 0 }
      typeMap[t].count++
      typeMap[t].rent += u.annualRent
      typeMap[t].sqft += u.sqFt
    }
    const unitTypeBreakdown = Object.entries(typeMap).map(([type, v]) => ({ type, count: v.count, rent: v.rent, sqft: v.sqft }))

    // Nationality distribution
    const natMap: Record<string, number> = {}
    for (const u of unitsView) {
      if (u.tenant?.nationality) {
        const n = u.tenant.nationality
        natMap[n] = (natMap[n] || 0) + 1
      }
    }
    const nationalityBreakdown = Object.entries(natMap)
      .map(([nationality, count]) => ({ nationality, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    const occupied = unitsView.filter((u) => u.status === 'Occupied').length
    const vacant = unitsView.filter((u) => u.status === 'Vacant').length
    const annualRentRoll = unitsView.filter((u) => u.status === 'Occupied').reduce((s, u) => s + u.annualRent, 0)
    const totalCollected = unitsView.reduce((s, u) => s + u.collected, 0)
    const totalPending = unitsView.reduce((s, u) => s + u.pending, 0)
    const occupancyPct = unitsView.length > 0 ? Math.round((occupied / unitsView.length) * 100) : 0

    const totalInvoiced = invoices.reduce((s, i) => s + (i.totalAmount || 0), 0)
    const invoicePaid = invoices.reduce((s, i) => s + (i.paidAmount || 0), 0)
    const overdueInvoices = invoices.filter((i) => i.dueDate && i.dueDate < today && (i.paidAmount || 0) < (i.totalAmount || 0))

    // Expenses (from maintenance actualCost + completed tickets)
    const maintenanceExpense = tickets.reduce((s, t) => s + (((t as unknown) as { actualCost?: number }).actualCost || 0), 0)
    const violationsIssued = violations.reduce((s, v) => s + (v.fineAmount || 0), 0)
    const violationsPaid = violations.filter((v) => v.status === 'Paid').reduce((s, v) => s + (v.fineAmount || 0), 0)

    const grossRevenue = chequeBuckets.cleared + totalCollected
    const netOperatingIncome = grossRevenue - maintenanceExpense
    const profitMargin = grossRevenue > 0 ? (netOperatingIncome / grossRevenue) * 100 : 0

    // Renewals upcoming
    const upcomingRenewals = unitsView
      .filter((u) => u.contractEnd && u.contractEnd >= today && u.contractEnd <= upcoming90Str)
      .sort((a, b) => a.contractEnd.localeCompare(b.contractEnd))

    // Top & worst performers
    const topContributors = [...unitsView]
      .filter((u) => u.annualRent > 0)
      .sort((a, b) => b.annualRent - a.annualRent)
      .slice(0, 10)

    const worstCollection = [...unitsView]
      .filter((u) => u.annualRent > 0)
      .sort((a, b) => b.pending - a.pending)
      .slice(0, 5)

    // Avg rent per sqft
    const unitsWithSqft = unitsView.filter((u) => u.sqFt > 0 && u.annualRent > 0)
    const avgRentPerSqft = unitsWithSqft.length > 0
      ? unitsWithSqft.reduce((s, u) => s + u.rentPerSqft, 0) / unitsWithSqft.length
      : 0

    return NextResponse.json({
      owner: {
        ownerName: owner.ownerName,
        email: owner.email,
        phone: owner.phone,
        buildingName: owner.buildingName,
        area: owner.area,
        emirate: owner.emirate,
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
        overdueInvoices: overdueInvoices.length,
        maintenanceExpense,
        violationsIssued,
        violationsPaid,
        grossRevenue,
        netOperatingIncome,
        profitMargin,
        avgRentPerSqft,
      },
      chequeBuckets,
      cashflowProjection: Object.values(monthly),
      unitTypeBreakdown,
      nationalityBreakdown,
      units: unitsView,
      topContributors,
      worstCollection,
      upcomingRenewals,
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
        totalAmount: i.totalAmount,
        paidAmount: i.paidAmount,
        status: i.status,
        dueDate: i.dueDate,
        tenantName: units.find((u) => u.tenantId === i.tenantId)?.tenant?.name || '—',
        unitNo: units.find((u) => u.tenantId === i.tenantId)?.unitNo || '—',
      })),
      complaints: complaints.map((c) => ({ id: c.id, complaintNo: c.complaintNo, subject: c.subject, status: c.status, createdAt: c.createdAt })),
      tickets: tickets.slice(0, 10).map((t) => ({ id: t.id, ticketNo: t.ticketNo, title: t.title, priority: t.priority, status: t.status, submittedAt: t.submittedAt })),
    })
  } catch (error) {
    console.error('GET /api/owner/dashboard error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
