import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

// GET — single bill detail (org-scoped).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const bill = await prisma.vendorBill.findFirst({
      where: { id, organizationId: session.user.organizationId },
      include: {
        vendor: true,
        unit: { select: { id: true, unitNo: true, unitType: true } },
        tenant: { select: { id: true, name: true, email: true, phone: true } },
        owner: { select: { id: true, ownerName: true, email: true } },
      },
    })
    if (!bill) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(bill)
  } catch (error) {
    console.error('GET /api/vendor-bills/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH — update bill fields, approve, reject, or mark Paid.
//
// Approve / Reject is reserved for the org admin (role==="admin") on the
// staff side; the owner portal calls a separate endpoint with its own auth.
// Mark Paid + edit-fields are open to any org user.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const organizationId = session.user.organizationId
    const { id } = await params

    const existing = await prisma.vendorBill.findFirst({ where: { id, organizationId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json()
    const action = body.action as 'approve' | 'reject' | 'markPaid' | undefined
    const data: Record<string, unknown> = {}

    // State-machine transitions
    if (action === 'approve') {
      if (existing.status !== 'PendingApproval') {
        return NextResponse.json({ error: `Cannot approve a bill in status "${existing.status}"` }, { status: 400 })
      }
      if (session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Only an admin can approve from the staff side' }, { status: 403 })
      }
      data.status = 'Approved'
      data.approvedBy = session.user.name || session.user.email || 'admin'
      data.approvedAt = new Date()
      data.approverNote = (body.approverNote || '').toString()
    } else if (action === 'reject') {
      if (existing.status !== 'PendingApproval') {
        return NextResponse.json({ error: `Cannot reject a bill in status "${existing.status}"` }, { status: 400 })
      }
      if (session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Only an admin can reject from the staff side' }, { status: 403 })
      }
      data.status = 'Rejected'
      data.rejectReason = (body.rejectReason || '').toString()
      data.approvedBy = session.user.name || session.user.email || 'admin'
      data.approvedAt = new Date()
    } else if (action === 'markPaid') {
      if (existing.status !== 'Approved') {
        return NextResponse.json({ error: 'Bill must be Approved before marking Paid' }, { status: 400 })
      }
      data.status = 'Paid'
      data.paidAt = new Date()
      // Allow updating payment fields on paid transition
      const editable = ['paymentMethod', 'paymentDate', 'chequeNo', 'chequeBank', 'chequeDate', 'bankRef', 'bankName']
      for (const k of editable) if (body[k] !== undefined) data[k] = body[k]
    } else {
      // Field-level edits (no state change)
      const editable = [
        'billNo', 'billDate', 'serviceType', 'description',
        'baseAmount', 'vatAmount', 'totalAmount',
        'paymentMethod', 'paymentDate', 'chequeNo', 'chequeBank', 'chequeDate', 'bankRef', 'bankName',
        'notes',
      ]
      for (const k of editable) if (body[k] !== undefined) data[k] = body[k]
    }

    const updated = await prisma.vendorBill.update({ where: { id }, data })

    await logActivity(
      organizationId,
      session.user.name || session.user.email || 'unknown',
      `Vendor Bill ${action || 'updated'}`,
      `${existing.billNo || existing.id} · status=${updated.status}${data.rejectReason ? ` · ${data.rejectReason}` : ''}`
    )

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/vendor-bills/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE — only allowed when status === "PendingApproval".
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const existing = await prisma.vendorBill.findFirst({
      where: { id, organizationId: session.user.organizationId },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing.status !== 'PendingApproval') {
      return NextResponse.json({ error: 'Only Pending bills can be deleted' }, { status: 400 })
    }
    await prisma.vendorBill.delete({ where: { id } })
    await logActivity(
      session.user.organizationId,
      session.user.name || session.user.email || 'unknown',
      'Vendor Bill Deleted',
      existing.billNo || existing.id
    )
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/vendor-bills/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
