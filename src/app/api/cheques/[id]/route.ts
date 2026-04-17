import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { createNotification } from '@/lib/notifications'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    const { id } = await params
    const body = await request.json()

    const existing = await prisma.cheque.findFirst({
      where: { id, organizationId },
      include: { tenant: { select: { id: true, name: true } } },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Cheque not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    if (body.chequeNo !== undefined) updateData.chequeNo = body.chequeNo
    if (body.chequeDate !== undefined) updateData.chequeDate = body.chequeDate
    if (body.amount !== undefined) updateData.amount = parseFloat(body.amount)
    if (body.bankName !== undefined) updateData.bankName = body.bankName
    if (body.status !== undefined) updateData.status = body.status
    if (body.paymentType !== undefined) updateData.paymentType = body.paymentType
    if (body.periodFrom !== undefined) updateData.periodFrom = body.periodFrom
    if (body.periodTo !== undefined) updateData.periodTo = body.periodTo
    if (body.sequenceNo !== undefined) updateData.sequenceNo = parseInt(body.sequenceNo, 10)
    if (body.totalCheques !== undefined) updateData.totalCheques = parseInt(body.totalCheques, 10)
    if (body.bouncedReason !== undefined) updateData.bouncedReason = body.bouncedReason
    if (body.clearedDate !== undefined) updateData.clearedDate = body.clearedDate
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.unitId !== undefined) updateData.unitId = body.unitId || null

    const cheque = await prisma.cheque.update({
      where: { id },
      data: updateData,
      include: {
        tenant: { select: { id: true, name: true } },
        unit: { select: { id: true, unitNo: true } },
      },
    })

    // Notify tenant on status change
    if (body.status && body.status !== existing.status) {
      await createNotification(
        organizationId,
        'tenant',
        existing.tenantId,
        `Cheque ${existing.chequeNo || 'N/A'} status updated to ${body.status}`,
        `Your cheque for AED ${existing.amount.toFixed(2)} has been updated to ${body.status}.`,
        'payment'
      )

      // Auto-email tenant a Statement of Account when a cheque clears or
      // bounces, so they always have the latest paid / pending picture.
      if (['Cleared', 'Bounced'].includes(body.status)) {
        try {
          const baseUrl = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '')
          // Re-use the existing rent-status endpoint by calling it server-side
          // with a synthesized session would be complex. Instead inline-build
          // and send the email here.
          const tenant = await prisma.tenant.findUnique({
            where: { id: existing.tenantId },
            include: { units: { select: { unitNo: true } } },
          })
          const contract = await prisma.tenancyContract.findFirst({
            where: { organizationId, tenantId: existing.tenantId },
            orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
          })
          if (tenant?.email && contract) {
            const allCheques = await prisma.cheque.findMany({
              where: { organizationId, tenantId: existing.tenantId },
              orderBy: { sequenceNo: 'asc' },
            })
            const UPFRONT_PREFIX = 'UPFRONT_JSON:'
            let upfront = { cash: 0, chequeAmount: 0 }
            for (const line of (contract.notes || '').split('\n')) {
              if (line.startsWith(UPFRONT_PREFIX)) {
                try { upfront = { ...upfront, ...JSON.parse(line.slice(UPFRONT_PREFIX.length)) } } catch {}
              }
            }
            const aed = (n: number) => `AED ${Number(n || 0).toLocaleString()}`
            const upfrontTotal = upfront.cash + upfront.chequeAmount
            const cleared = allCheques
              .filter((x) => x.status === 'Cleared' && !(x.sequenceNo === 1 && x.paymentType === 'Upfront'))
              .reduce((s, x) => s + (x.amount || 0), 0)
            const totalPaid = upfrontTotal + cleared
            const annualRent = contract.rentAmount || 0
            const remaining = Math.max(0, annualRent - totalPaid)
            const isCleared = body.status === 'Cleared'
            const heading = isCleared
              ? `Payment Received — ${aed(existing.amount)}`
              : `Cheque Rejected — ${aed(existing.amount)}`
            const headingColor = isCleared ? '#059669' : '#dc2626'

            const rowsHtml = allCheques.map((x) => {
              const badge = x.status === 'Cleared'
                ? '<span style="background:#d1fae5;color:#065f46;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600;">CLEARED</span>'
                : x.status === 'Bounced'
                ? '<span style="background:#fee2e2;color:#991b1b;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600;">REJECTED</span>'
                : '<span style="background:#f3f4f6;color:#374151;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600;">PENDING</span>'
              return `<tr style="border-bottom:1px solid #e5e7eb;">
                <td style="padding:6px 8px;font-size:11px;">Cheque ${x.sequenceNo}${x.paymentType === 'Upfront' ? ' (Upfront)' : ''}</td>
                <td style="padding:6px 8px;font-size:11px;font-family:monospace;">${(x.chequeNo || '—').replace(/[<>]/g, '')}</td>
                <td style="padding:6px 8px;font-size:11px;">${(x.chequeDate || '—').replace(/[<>]/g, '')}</td>
                <td style="padding:6px 8px;font-size:11px;text-align:right;font-weight:600;">${aed(x.amount)}</td>
                <td style="padding:6px 8px;font-size:11px;">${badge}</td>
              </tr>`
            }).join('')

            const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,sans-serif;color:#111;">
              <div style="max-width:600px;margin:24px auto;padding:32px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;">
                <div style="border-bottom:3px solid ${headingColor};padding-bottom:14px;margin-bottom:18px;">
                  <h1 style="margin:0;font-size:20px;color:${headingColor};">${heading}</h1>
                  <p style="margin:4px 0 0 0;font-size:12px;color:#6b7280;">Alwaan L.L.C. · ${new Date().toLocaleDateString('en-GB')}</p>
                </div>
                <p style="margin:0 0 14px 0;">Dear ${tenant.name.replace(/[<>]/g, '')},</p>
                <p style="margin:0 0 14px 0;">${isCleared
                  ? `Your cheque <strong>#${(existing.chequeNo || '').replace(/[<>]/g, '')}</strong> for ${aed(existing.amount)} has cleared. Thank you.`
                  : `Your cheque <strong>#${(existing.chequeNo || '').replace(/[<>]/g, '')}</strong> for ${aed(existing.amount)} was returned by the bank${body.bouncedReason ? ` (reason: ${String(body.bouncedReason).replace(/[<>]/g, '')})` : ''}. Please contact us to arrange a replacement.`}</p>
                <div style="display:flex;gap:8px;margin:16px 0;">
                  <div style="flex:1;background:#dbeafe;border:1px solid #93c5fd;border-radius:8px;padding:10px;">
                    <p style="margin:0;font-size:10px;color:#1e40af;font-weight:600;text-transform:uppercase;">Total Paid</p>
                    <p style="margin:4px 0 0 0;font-size:16px;font-weight:700;color:#1e3a8a;">${aed(totalPaid)}</p>
                  </div>
                  <div style="flex:1;background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:10px;">
                    <p style="margin:0;font-size:10px;color:#92400e;font-weight:600;text-transform:uppercase;">Pending</p>
                    <p style="margin:4px 0 0 0;font-size:16px;font-weight:700;color:#78350f;">${aed(remaining)}</p>
                  </div>
                </div>
                <h3 style="margin:14px 0 6px 0;font-size:13px;">Your Cheque Schedule</h3>
                <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
                  <thead><tr style="background:#f9fafb;">
                    <th style="padding:6px 8px;text-align:left;font-size:10px;color:#6b7280;text-transform:uppercase;">#</th>
                    <th style="padding:6px 8px;text-align:left;font-size:10px;color:#6b7280;text-transform:uppercase;">Cheque #</th>
                    <th style="padding:6px 8px;text-align:left;font-size:10px;color:#6b7280;text-transform:uppercase;">Date</th>
                    <th style="padding:6px 8px;text-align:right;font-size:10px;color:#6b7280;text-transform:uppercase;">Amount</th>
                    <th style="padding:6px 8px;text-align:left;font-size:10px;color:#6b7280;text-transform:uppercase;">Status</th>
                  </tr></thead>
                  <tbody>${rowsHtml}</tbody>
                </table>
                <p style="margin:18px 0 0 0;font-size:11px;color:#6b7280;">Login to your portal: <a href="${baseUrl}/tenant/login" style="color:#E30613;">${baseUrl}/tenant/login</a></p>
              </div>
            </body></html>`

            const { sendEmail } = await import('@/lib/email')
            await sendEmail({
              organizationId,
              to: tenant.email,
              toName: tenant.name,
              subject: heading + ` — ${contract.contractNo}`,
              html,
              template: 'cheque_status_update',
              triggeredBy: session.user.name,
              refType: 'tenant',
              refId: tenant.id,
            }).catch((e) => console.warn('Cheque status email failed:', e))
          }
        } catch (e) {
          console.warn('Cheque status auto-email pipeline failed:', e)
        }
      }
    }

    await logActivity(
      organizationId,
      session.user.name,
      'Updated Cheque',
      `Cheque ${cheque.chequeNo || id} updated${body.status ? ` - status: ${body.status}` : ''}`
    )

    return NextResponse.json(cheque)
  } catch (error) {
    console.error('PUT /api/cheques/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    const { id } = await params

    const cheque = await prisma.cheque.findFirst({
      where: { id, organizationId },
    })

    if (!cheque) {
      return NextResponse.json({ error: 'Cheque not found' }, { status: 404 })
    }

    if (cheque.status === 'Cleared') {
      return NextResponse.json(
        { error: 'Cannot delete a cleared cheque' },
        { status: 400 }
      )
    }

    await prisma.cheque.delete({
      where: { id },
    })

    await logActivity(
      organizationId,
      session.user.name,
      'Deleted Cheque',
      `Cheque ${cheque.chequeNo || id} deleted`
    )

    return NextResponse.json({ message: 'Cheque deleted successfully' })
  } catch (error) {
    console.error('DELETE /api/cheques/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
