import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getOwnerSession } from '@/lib/owner-auth'
import { logActivity } from '@/lib/activity'

// PATCH — owner approves or rejects a pending vendor bill that belongs to them.
// Body: { action: "approve" | "reject", note?: string }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = getOwnerSession(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const existing = await prisma.vendorBill.findFirst({
      where: { id, organizationId: session.orgId, ownerId: session.id },
    })
    if (!existing) return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
    if (existing.status !== 'PendingApproval') {
      return NextResponse.json({ error: `Bill is already ${existing.status}` }, { status: 400 })
    }

    const body = await req.json()
    const action = body.action as 'approve' | 'reject' | undefined
    const note = (body.note || '').toString()

    const data: Record<string, unknown> = {
      approvedBy: session.name,
      approvedAt: new Date(),
    }
    if (action === 'approve') {
      data.status = 'Approved'
      data.approverNote = note
    } else if (action === 'reject') {
      if (!note || note.length < 2) return NextResponse.json({ error: 'Reject reason is required' }, { status: 400 })
      data.status = 'Rejected'
      data.rejectReason = note
    } else {
      return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
    }

    const updated = await prisma.vendorBill.update({ where: { id }, data })

    await logActivity(
      session.orgId,
      `Owner: ${session.name}`,
      `Vendor Bill ${action === 'approve' ? 'Approved by Owner' : 'Rejected by Owner'}`,
      `${existing.billNo || existing.id} · ${note || ''}`.slice(0, 200)
    )

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/owner/vendor-bills/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
