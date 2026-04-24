import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const organizationId = session.user.organizationId
    const today = new Date().toISOString().slice(0, 10)

    // 1. Bounced cheques
    const bouncedCheques = await prisma.cheque.findMany({
      where: { organizationId, status: 'Bounced' },
      include: {
        tenant: { select: { id: true, name: true, phone: true } },
        unit: { select: { id: true, unitNo: true } },
      },
      orderBy: { chequeDate: 'desc' },
    })

    // 2. Expired contracts (unit.contractEnd < today AND tenant is still there)
    const expiredContracts = await prisma.unit.findMany({
      where: {
        organizationId,
        tenantId: { not: null },
        contractEnd: { lt: today, not: '' },
        status: 'Occupied',
        deletedAt: null,
      },
      include: {
        tenant: { select: { id: true, name: true, phone: true, email: true } },
      },
      orderBy: { contractEnd: 'asc' },
    })

    // 3. Unpaid violations
    const unpaidViolations = await prisma.violation.findMany({
      where: { organizationId, status: { in: ['Pending', 'Issued', 'Overdue', 'Unpaid'] } },
      include: {
        tenant: { select: { id: true, name: true } },
        unit: { select: { id: true, unitNo: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // 4. Overdue invoices
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        organizationId,
        dueDate: { lt: today, not: '' },
        status: { notIn: ['Paid', 'Cancelled', 'Void'] },
      },
      include: {
        tenant: { select: { id: true, name: true } },
        unit: { select: { id: true, unitNo: true } },
      },
      orderBy: { dueDate: 'asc' },
    })

    // 5. Blacklisted tenants
    const blacklisted = await prisma.tenant.findMany({
      where: { organizationId, status: 'Blacklisted' },
      select: { id: true, name: true, phone: true, emiratesId: true, notes: true, updatedAt: true },
    })

    // 6. Tenants being vacated
    const vacating = await prisma.tenant.findMany({
      where: { organizationId, status: { in: ['Vacating', 'Terminated'] } },
      include: {
        units: { select: { unitNo: true } },
      },
    })

    // Aggregated totals
    const bouncedAmount = bouncedCheques.reduce((s, c) => s + (c.amount || 0), 0)
    const expiredContractsCount = expiredContracts.length
    const unpaidViolationsAmount = unpaidViolations.reduce((s, v) => s + (v.fineAmount || 0), 0)
    const overdueInvoicesAmount = overdueInvoices.reduce((s, i) => s + ((i.totalAmount || 0) - (i.paidAmount || 0)), 0)

    return NextResponse.json({
      summary: {
        bouncedCheques: bouncedCheques.length,
        bouncedAmount,
        expiredContracts: expiredContractsCount,
        unpaidViolations: unpaidViolations.length,
        unpaidViolationsAmount,
        overdueInvoices: overdueInvoices.length,
        overdueInvoicesAmount,
        blacklisted: blacklisted.length,
        vacating: vacating.length,
      },
      bouncedCheques: bouncedCheques.map((c) => ({
        id: c.id,
        chequeNo: c.chequeNo,
        chequeDate: c.chequeDate,
        amount: c.amount,
        bankName: c.bankName,
        bouncedReason: c.bouncedReason,
        tenantId: c.tenantId,
        tenantName: c.tenant?.name || '—',
        tenantPhone: c.tenant?.phone || '',
        unitNo: c.unit?.unitNo || '',
      })),
      expiredContracts: expiredContracts.map((u) => ({
        unitId: u.id,
        unitNo: u.unitNo,
        tenantId: u.tenantId,
        tenantName: u.tenant?.name || '—',
        tenantPhone: u.tenant?.phone || '',
        contractEnd: u.contractEnd,
        daysOverdue: Math.floor((new Date(today).getTime() - new Date(u.contractEnd).getTime()) / 86400000),
        currentRent: u.currentRent,
      })),
      unpaidViolations: unpaidViolations.map((v) => ({
        id: v.id,
        violationNo: v.violationNo,
        type: v.type,
        severity: v.severity,
        fineAmount: v.fineAmount,
        status: v.status,
        tenantName: v.tenant?.name || '—',
        unitNo: v.unit?.unitNo || '',
        createdAt: v.createdAt,
      })),
      overdueInvoices: overdueInvoices.map((i) => ({
        id: i.id,
        invoiceNo: i.invoiceNo,
        dueDate: i.dueDate,
        totalAmount: i.totalAmount,
        paidAmount: i.paidAmount,
        outstanding: (i.totalAmount || 0) - (i.paidAmount || 0),
        status: i.status,
        tenantName: i.tenant?.name || '—',
        unitNo: i.unit?.unitNo || '',
      })),
      blacklisted,
      vacating: vacating.map((t) => ({
        id: t.id,
        name: t.name,
        status: t.status,
        phone: t.phone,
        unitNo: t.units[0]?.unitNo || '',
      })),
    })
  } catch (error) {
    console.error('GET /api/legal error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
