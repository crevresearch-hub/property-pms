import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

function getStatus(value: number, target: number, higherIsBetter: boolean): string {
  if (higherIsBetter) {
    if (value >= target) return 'green'
    if (value >= target * 0.85) return 'amber'
    return 'red'
  } else {
    if (value <= target) return 'green'
    if (value <= target * 1.15) return 'amber'
    return 'red'
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    const today = new Date().toISOString().split('T')[0]
    const currentMonth = today.substring(0, 7) // YYYY-MM
    const monthStart = `${currentMonth}-01`
    const now = new Date()

    // 1. Occupancy Rate
    const totalUnits = await prisma.unit.count({ where: { organizationId } })
    const occupiedUnits = await prisma.unit.count({
      where: { organizationId, status: 'Occupied' },
    })
    const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0

    // 2. Renewals on Time (contracts renewed before expiry in the last 90 days)
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const totalRenewals = await prisma.renewalRequest.count({
      where: {
        organizationId,
        requestedAt: { gte: new Date(ninetyDaysAgo) },
        status: { in: ['Accepted', 'Completed'] },
      },
    })
    const allRecentRenewals = await prisma.renewalRequest.count({
      where: {
        organizationId,
        requestedAt: { gte: new Date(ninetyDaysAgo) },
      },
    })
    const renewalOnTimeRate = allRecentRenewals > 0
      ? (totalRenewals / allRecentRenewals) * 100
      : 100

    // 3. Expired Contracts
    const expiredContracts = await prisma.unit.count({
      where: {
        organizationId,
        status: 'Occupied',
        contractEnd: { not: '', lt: today },
      },
    })

    // 4. Complaint Resolution (resolved vs total)
    const totalComplaints = await prisma.complaint.count({ where: { organizationId } })
    const resolvedComplaints = await prisma.complaint.count({
      where: { organizationId, status: 'Resolved' },
    })
    const complaintResolutionRate = totalComplaints > 0
      ? (resolvedComplaints / totalComplaints) * 100
      : 100

    // 5. Document Completeness
    const totalDocs = await prisma.tenantDocument.count({ where: { organizationId } })
    const approvedDocs = await prisma.tenantDocument.count({
      where: { organizationId, status: 'Approved' },
    })
    const docCompletenessRate = totalDocs > 0
      ? (approvedDocs / totalDocs) * 100
      : 100

    // 6. Cheque Clearance Rate
    const totalCheques = await prisma.cheque.count({ where: { organizationId } })
    const clearedCheques = await prisma.cheque.count({
      where: { organizationId, status: 'Cleared' },
    })
    const chequeClearanceRate = totalCheques > 0
      ? (clearedCheques / totalCheques) * 100
      : 100

    // 7. Bounced Cheques This Month
    const bouncedThisMonth = await prisma.cheque.count({
      where: {
        organizationId,
        status: 'Bounced',
        updatedAt: { gte: new Date(monthStart) },
      },
    })

    // 8. Open Maintenance Tickets
    const openMaintenance = await prisma.maintenanceTicket.count({
      where: {
        organizationId,
        status: { in: ['Submitted', 'Acknowledged', 'In Progress', 'Assigned'] },
      },
    })

    // 9. Violations This Month
    const violationsThisMonth = await prisma.violation.count({
      where: {
        organizationId,
        createdAt: { gte: new Date(monthStart) },
      },
    })

    // 10. Vacant Units + Revenue Loss
    const vacantUnits = await prisma.unit.findMany({
      where: { organizationId, status: 'Vacant' },
      select: { currentRent: true },
    })
    const vacantCount = vacantUnits.length
    const monthlyRevenueLoss = vacantUnits.reduce((sum: number, u: { currentRent: number }) => sum + (u.currentRent / 12), 0)

    // 11. Pending Fees
    const pendingFees = await prisma.feeLedger.findMany({
      where: { organizationId, status: 'Pending' },
      select: { amount: true },
    })
    const pendingFeesCount = pendingFees.length
    const pendingFeesTotal = pendingFees.reduce((sum: number, f: { amount: number }) => sum + f.amount, 0)

    const kpis = [
      {
        id: 'occupancy_rate',
        name: 'Occupancy Rate',
        value: Math.round(occupancyRate * 100) / 100,
        unit: '%',
        target: 90,
        status: getStatus(occupancyRate, 90, true),
      },
      {
        id: 'renewals_on_time',
        name: 'Renewals On Time',
        value: Math.round(renewalOnTimeRate * 100) / 100,
        unit: '%',
        target: 85,
        status: getStatus(renewalOnTimeRate, 85, true),
      },
      {
        id: 'expired_contracts',
        name: 'Expired Contracts',
        value: expiredContracts,
        unit: 'count',
        target: 0,
        status: getStatus(expiredContracts, 0, false),
      },
      {
        id: 'complaint_resolution',
        name: 'Complaint Resolution Rate',
        value: Math.round(complaintResolutionRate * 100) / 100,
        unit: '%',
        target: 80,
        status: getStatus(complaintResolutionRate, 80, true),
      },
      {
        id: 'doc_completeness',
        name: 'Document Completeness',
        value: Math.round(docCompletenessRate * 100) / 100,
        unit: '%',
        target: 90,
        status: getStatus(docCompletenessRate, 90, true),
      },
      {
        id: 'cheque_clearance',
        name: 'Cheque Clearance Rate',
        value: Math.round(chequeClearanceRate * 100) / 100,
        unit: '%',
        target: 95,
        status: getStatus(chequeClearanceRate, 95, true),
      },
      {
        id: 'bounced_this_month',
        name: 'Bounced Cheques This Month',
        value: bouncedThisMonth,
        unit: 'count',
        target: 0,
        status: getStatus(bouncedThisMonth, 0, false),
      },
      {
        id: 'open_maintenance',
        name: 'Open Maintenance Tickets',
        value: openMaintenance,
        unit: 'count',
        target: 5,
        status: getStatus(openMaintenance, 5, false),
      },
      {
        id: 'violations_this_month',
        name: 'Violations This Month',
        value: violationsThisMonth,
        unit: 'count',
        target: 3,
        status: getStatus(violationsThisMonth, 3, false),
      },
      {
        id: 'vacant_units',
        name: 'Vacant Units & Revenue Loss',
        value: vacantCount,
        unit: 'count',
        target: 2,
        status: getStatus(vacantCount, 2, false),
        monthly_revenue_loss: Math.round(monthlyRevenueLoss * 100) / 100,
      },
      {
        id: 'pending_fees',
        name: 'Pending Fees',
        value: pendingFeesCount,
        unit: 'count',
        target: 5,
        status: getStatus(pendingFeesCount, 5, false),
        total_pending: Math.round(pendingFeesTotal * 100) / 100,
      },
    ]

    return NextResponse.json({ kpis })
  } catch (error) {
    console.error('GET /api/kpi error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
