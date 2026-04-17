import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { calculateFee } from '@/lib/fees'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    const body = await request.json()

    const { unitId, tenantId, moveOutDate, isEarlyTermination } = body

    if (!unitId) {
      return NextResponse.json(
        { error: 'Unit ID is required' },
        { status: 400 }
      )
    }

    // Fetch unit
    const unit = await prisma.unit.findFirst({
      where: { id: unitId, organizationId },
    })
    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
    }

    // Fetch tenant
    const resolvedTenantId = tenantId || unit.tenantId
    let tenant = null
    if (resolvedTenantId) {
      tenant = await prisma.tenant.findFirst({
        where: { id: resolvedTenantId, organizationId },
      })
    }

    const isCommercial = unit.unitType.toLowerCase().includes('commercial') || unit.unitType.toLowerCase().includes('shop') || unit.unitType.toLowerCase().includes('office')
    const unitTypeKey = isCommercial ? 'commercial' : 'residential'
    const annualRent = unit.currentRent

    // Early termination penalty calculation
    const contractEndDate = unit.contractEnd ? new Date(unit.contractEnd) : null
    const vacateDate = moveOutDate ? new Date(moveOutDate) : new Date()
    let earlyTermination = isEarlyTermination === true

    // Auto-detect early termination if vacate date is before contract end
    if (contractEndDate && vacateDate < contractEndDate) {
      earlyTermination = true
    }

    const earlyTerminationPenalty = earlyTermination
      ? calculateFee(`early_termination_${unitTypeKey}`, annualRent)
      : 0

    // Calculate remaining rent if leaving mid-period
    let remainingRentDays = 0
    let proRatedRent = 0
    if (contractEndDate && vacateDate < contractEndDate) {
      remainingRentDays = Math.ceil(
        (contractEndDate.getTime() - vacateDate.getTime()) / (1000 * 60 * 60 * 24)
      )
      // Pro-rated daily rent for unused period (informational)
      const dailyRent = annualRent / 365
      proRatedRent = remainingRentDays * dailyRent
    }

    // Get outstanding invoices
    const outstandingInvoices = await prisma.invoice.findMany({
      where: {
        organizationId,
        unitId,
        status: { in: ['Sent', 'Overdue', 'Partially Paid'] },
      },
      select: {
        id: true,
        invoiceNo: true,
        totalAmount: true,
        paidAmount: true,
        status: true,
        dueDate: true,
        type: true,
      },
    })

    const totalOutstanding = outstandingInvoices.reduce(
      (sum: number, inv: typeof outstandingInvoices[number]) => sum + (inv.totalAmount - inv.paidAmount),
      0
    )

    // Get pending cheques
    const pendingCheques = await prisma.cheque.findMany({
      where: {
        organizationId,
        unitId,
        status: { in: ['Received', 'Deposited'] },
      },
      select: {
        id: true,
        chequeNo: true,
        amount: true,
        chequeDate: true,
        status: true,
      },
    })

    const securityDepositAmount = calculateFee(`security_deposit_${unitTypeKey}`, annualRent)

    // Build the move-out checklist
    const checklist = {
      unitNo: unit.unitNo,
      unitType: isCommercial ? 'Commercial' : 'Residential',
      tenantName: tenant?.name || 'N/A',
      tenantId: tenant?.id || null,
      contractStart: unit.contractStart,
      contractEnd: unit.contractEnd,
      moveOutDate: moveOutDate || new Date().toISOString().split('T')[0],
      isEarlyTermination: earlyTermination,

      inspectionItems: [
        {
          id: 1,
          category: 'Keys & Access',
          item: 'All unit keys returned',
          status: 'Pending',
          notes: '',
        },
        {
          id: 2,
          category: 'Keys & Access',
          item: 'Access cards / fobs returned',
          status: 'Pending',
          notes: '',
        },
        {
          id: 3,
          category: 'Keys & Access',
          item: 'Parking card / remote returned',
          status: 'Pending',
          notes: '',
        },
        {
          id: 4,
          category: 'Keys & Access',
          item: 'Intercom / gate remote returned',
          status: 'Pending',
          notes: '',
        },
        {
          id: 5,
          category: 'Unit Condition',
          item: 'Walls and paint condition inspected',
          status: 'Pending',
          notes: '',
        },
        {
          id: 6,
          category: 'Unit Condition',
          item: 'Flooring / tiles condition inspected',
          status: 'Pending',
          notes: '',
        },
        {
          id: 7,
          category: 'Unit Condition',
          item: 'Kitchen appliances and fixtures inspected',
          status: 'Pending',
          notes: '',
        },
        {
          id: 8,
          category: 'Unit Condition',
          item: 'Bathroom fixtures and plumbing inspected',
          status: 'Pending',
          notes: '',
        },
        {
          id: 9,
          category: 'Unit Condition',
          item: 'AC units serviced and filters cleaned',
          status: 'Pending',
          notes: '',
        },
        {
          id: 10,
          category: 'Unit Condition',
          item: 'Electrical switches, sockets, and lights functional',
          status: 'Pending',
          notes: '',
        },
        {
          id: 11,
          category: 'Unit Condition',
          item: 'Windows and doors condition inspected',
          status: 'Pending',
          notes: '',
        },
        {
          id: 12,
          category: 'Unit Condition',
          item: 'Balcony / terrace cleared and inspected',
          status: 'Pending',
          notes: '',
        },
        {
          id: 13,
          category: 'Utilities & Clearance',
          item: 'DEWA final bill settled / disconnection arranged',
          status: 'Pending',
          notes: '',
        },
        {
          id: 14,
          category: 'Utilities & Clearance',
          item: 'Internet / telecom disconnection confirmed',
          status: 'Pending',
          notes: '',
        },
        {
          id: 15,
          category: 'Utilities & Clearance',
          item: 'Gas connection closed (if applicable)',
          status: 'Pending',
          notes: '',
        },
        {
          id: 16,
          category: 'Documentation',
          item: 'EJARI cancellation processed',
          status: 'Pending',
          notes: '',
        },
        {
          id: 17,
          category: 'Documentation',
          item: 'Building management NOC obtained',
          status: 'Pending',
          notes: '',
        },
        {
          id: 18,
          category: 'Documentation',
          item: 'Move-out inspection report signed by both parties',
          status: 'Pending',
          notes: '',
        },
        {
          id: 19,
          category: 'Cleaning',
          item: 'Unit professionally cleaned',
          status: 'Pending',
          notes: '',
        },
        {
          id: 20,
          category: 'Cleaning',
          item: 'All personal belongings and furniture removed',
          status: 'Pending',
          notes: '',
        },
      ],

      financialSummary: {
        securityDeposit: {
          amount: securityDepositAmount,
          status: 'Held',
          notes: 'Refundable after inspection and clearance of all dues',
        },
        earlyTermination: {
          applicable: earlyTermination,
          penalty: earlyTerminationPenalty,
          penaltyType: isCommercial ? '3 months rent' : '2 months rent',
          remainingDays: remainingRentDays,
          proRatedUnusedRent: Math.round(proRatedRent * 100) / 100,
        },
        outstandingInvoices: {
          count: outstandingInvoices.length,
          totalAmount: totalOutstanding,
          invoices: outstandingInvoices,
        },
        pendingCheques: {
          count: pendingCheques.length,
          cheques: pendingCheques,
          notes: 'Un-deposited cheques to be returned after clearance',
        },
        estimatedDeductions: {
          earlyTerminationPenalty,
          outstandingRent: totalOutstanding,
          damageCharges: 0,
          cleaningCharges: 0,
          otherCharges: 0,
          totalDeductions: earlyTerminationPenalty + totalOutstanding,
        },
        estimatedRefund: Math.max(
          0,
          securityDepositAmount - earlyTerminationPenalty - totalOutstanding
        ),
        notes: 'Final refund amount subject to inspection results. Damage charges and cleaning fees will be assessed during move-out inspection. Refund processed within 30 days of vacating.',
      },

      timeline: [
        {
          step: 1,
          action: 'Submit written move-out notice',
          deadline: '90 days before vacating',
          status: 'Pending',
        },
        {
          step: 2,
          action: 'Schedule pre-move-out inspection',
          deadline: '30 days before vacating',
          status: 'Pending',
        },
        {
          step: 3,
          action: 'Arrange DEWA disconnection',
          deadline: '14 days before vacating',
          status: 'Pending',
        },
        {
          step: 4,
          action: 'Professional cleaning',
          deadline: '7 days before vacating',
          status: 'Pending',
        },
        {
          step: 5,
          action: 'Final move-out inspection',
          deadline: 'On vacating date',
          status: 'Pending',
        },
        {
          step: 6,
          action: 'Return all keys and access cards',
          deadline: 'On vacating date',
          status: 'Pending',
        },
        {
          step: 7,
          action: 'EJARI cancellation',
          deadline: '7 days after vacating',
          status: 'Pending',
        },
        {
          step: 8,
          action: 'Security deposit refund processed',
          deadline: '30 days after vacating',
          status: 'Pending',
        },
      ],
    }

    await logActivity(
      organizationId,
      session.user.name,
      'Generated Move-Out Checklist',
      `Move-out checklist generated for Unit ${unit.unitNo}${earlyTermination ? ' [Early Termination]' : ''}`
    )

    return NextResponse.json(checklist)
  } catch (error) {
    console.error('POST /api/contracts/move-out error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
