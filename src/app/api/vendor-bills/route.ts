import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { sendEmail } from '@/lib/email'

// GET — list vendor bills for the org. Optional ?status=PendingApproval|Approved|Rejected|Paid filter.
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const organizationId = session.user.organizationId
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined

    const where: Record<string, unknown> = { organizationId }
    if (status) where.status = status

    const bills = await prisma.vendorBill.findMany({
      where,
      include: {
        vendor: { select: { id: true, companyName: true, phone: true, email: true, paymentMethods: true } },
        unit: { select: { id: true, unitNo: true } },
        tenant: { select: { id: true, name: true, email: true } },
        owner: { select: { id: true, ownerName: true, email: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json(bills)
  } catch (error) {
    console.error('GET /api/vendor-bills error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST — staff creates a new vendor bill. Defaults to PendingApproval.
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const organizationId = session.user.organizationId
    const body = await request.json()

    const {
      vendorId, unitId, tenantId, ownerId,
      billNo, billDate, serviceType, description,
      baseAmount, vatAmount, totalAmount,
      paymentMethod, paymentDate, chequeNo, chequeBank, chequeDate, bankRef, bankName,
      notes,
    } = body

    if (!vendorId) return NextResponse.json({ error: 'vendorId is required' }, { status: 400 })
    if (!baseAmount || Number(baseAmount) <= 0) {
      return NextResponse.json({ error: 'baseAmount must be > 0' }, { status: 400 })
    }

    // Verify vendor belongs to the org
    const vendor = await prisma.vendor.findFirst({ where: { id: vendorId, organizationId } })
    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })

    // Auto-derive ownerId from unit's tenancy contract when not provided
    let resolvedOwnerId: string | null = ownerId || null
    let resolvedTenantId: string | null = tenantId || null
    if (unitId) {
      const unit = await prisma.unit.findFirst({
        where: { id: unitId, organizationId },
        include: { tenant: true },
      })
      if (unit) {
        if (!resolvedTenantId && unit.tenantId) resolvedTenantId = unit.tenantId
        if (!resolvedOwnerId) {
          const tc = await prisma.tenancyContract.findFirst({
            where: { organizationId, unitId },
            orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
            select: { ownerId: true },
          })
          if (tc?.ownerId) resolvedOwnerId = tc.ownerId
        }
      }
    }

    const base = Number(baseAmount) || 0
    const vat = Number(vatAmount ?? Math.round(base * 0.05))
    const total = Number(totalAmount ?? base + vat)

    const bill = await prisma.vendorBill.create({
      data: {
        organizationId,
        vendorId,
        unitId: unitId || null,
        tenantId: resolvedTenantId,
        ownerId: resolvedOwnerId,
        billNo: billNo || '',
        billDate: billDate || '',
        serviceType: serviceType || '',
        description: description || '',
        baseAmount: base,
        vatAmount: vat,
        totalAmount: total,
        paymentMethod: paymentMethod || '',
        paymentDate: paymentDate || '',
        chequeNo: chequeNo || '',
        chequeBank: chequeBank || '',
        chequeDate: chequeDate || '',
        bankRef: bankRef || '',
        bankName: bankName || '',
        status: 'PendingApproval',
        createdBy: session.user.name || session.user.email || 'unknown',
        notes: notes || '',
      },
    })

    await logActivity(
      organizationId,
      session.user.name || session.user.email || 'unknown',
      'Vendor Bill Created',
      `${vendor.companyName} · ${billNo || '(no bill #)'} · AED ${total.toLocaleString()} — Pending Approval`
    )

    // Notify the owner if we have their email
    if (resolvedOwnerId) {
      try {
        const owner = await prisma.propertyOwner.findUnique({
          where: { id: resolvedOwnerId },
          select: { email: true, ownerName: true },
        })
        if (owner?.email) {
          await sendEmail({
            organizationId,
            to: owner.email,
            toName: owner.ownerName,
            subject: `New Vendor Bill — Approval Required (${vendor.companyName})`,
            html: `
              <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px;color:#111;">
                <h2 style="color:#E30613;">Approval Required: Vendor Bill</h2>
                <p>Dear ${(owner.ownerName || '').replace(/[<>]/g, '')},</p>
                <p>A new vendor bill has been submitted for your approval.</p>
                <table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:13px;">
                  <tr><td style="padding:4px 0;color:#666;">Vendor:</td><td style="padding:4px 0;"><strong>${vendor.companyName}</strong></td></tr>
                  <tr><td style="padding:4px 0;color:#666;">Bill No:</td><td style="padding:4px 0;">${(billNo || '—').replace(/[<>]/g, '')}</td></tr>
                  <tr><td style="padding:4px 0;color:#666;">Service:</td><td style="padding:4px 0;">${(serviceType || '—').replace(/[<>]/g, '')}</td></tr>
                  <tr><td style="padding:4px 0;color:#666;">Amount:</td><td style="padding:4px 0;"><strong>AED ${total.toLocaleString()}</strong> (incl. VAT ${vat.toLocaleString()})</td></tr>
                </table>
                <p>Please review and approve this bill via the Owner Portal.</p>
              </div>`,
            template: 'vendor_bill_approval',
            triggeredBy: session.user.name || session.user.email,
            refType: 'vendor_bill',
            refId: bill.id,
          }).catch(() => {})
        }
      } catch { /* non-blocking */ }
    }

    return NextResponse.json(bill, { status: 201 })
  } catch (error) {
    console.error('POST /api/vendor-bills error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
