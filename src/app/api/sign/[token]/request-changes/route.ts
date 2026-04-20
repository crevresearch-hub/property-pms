import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { createNotification } from '@/lib/notifications'

/**
 * Public (unauthenticated) "Request Changes" endpoint for the owner sign page.
 * The signatureToken acts as the bearer credential.
 *
 * The owner uses this when reviewing the PM Agreement to ask Alwaan to amend
 * the draft before they sign. We:
 *   1. Mark the contract status "Changes Requested" (not Signed).
 *   2. Prepend the owner's feedback to contract.notes.
 *   3. Create an in-app notification for Alwaan staff.
 *   4. Email every active Alwaan admin a link to the owner edit page so they
 *      can update the draft and resend.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const notes = String(body?.notes || '').trim()
    if (!notes || notes.length < 3) {
      return NextResponse.json(
        { error: 'Please describe the changes you would like.' },
        { status: 400 }
      )
    }

    const contract = await prisma.ownerContract.findFirst({
      where: { signatureToken: token },
      include: { owner: true },
    })
    if (!contract) {
      return NextResponse.json(
        { error: 'Invalid or expired signature link' },
        { status: 404 }
      )
    }

    if (contract.ownerSignedAt) {
      return NextResponse.json(
        { error: 'This contract has already been signed and cannot be changed here.' },
        { status: 410 }
      )
    }

    const now = new Date()
    const stamp = now.toLocaleString('en-GB')

    const prepend = `[CHANGE REQUEST from owner, ${stamp}]: ${notes}\n---\n`
    const existingNotes = contract.notes || ''
    const newNotes = `${prepend}${existingNotes}`

    await prisma.ownerContract.update({
      where: { id: contract.id },
      data: {
        status: 'Changes Requested',
        notes: newNotes,
      },
    })

    // In-app notification for Alwaan staff
    await createNotification(
      contract.organizationId,
      'staff',
      '',
      'Owner Requested Changes',
      `Owner requested changes on ${contract.contractNo}`,
      'system'
    )

    // Email all Alwaan admins
    try {
      const baseUrl = process.env.NEXTAUTH_URL || ''
      const editUrl = `${baseUrl}/dashboard/owners/${contract.owner.id}/edit`
      const admins = await prisma.user.findMany({
        where: {
          organizationId: contract.organizationId,
          role: 'admin',
          isActive: true,
        },
      })

      const safeNotes = notes
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br/>')

      for (const admin of admins) {
        await sendEmail({
          organizationId: contract.organizationId,
          to: admin.email,
          toName: admin.name,
          subject: `Changes requested: ${contract.contractNo} — ${contract.owner.buildingName}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
              <div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:4px;margin-bottom:20px;">
                <h2 style="color:#b45309;margin:0 0 6px 0;">Owner Requested Changes</h2>
                <p style="margin:0;color:#78350f;">Action required: Review the feedback and update the draft.</p>
              </div>
              <p>Dear ${admin.name || 'Alwaan Admin'},</p>
              <p><strong>${contract.owner.ownerName}</strong> reviewed the Property Management
              Agreement for <strong>${contract.owner.buildingName}</strong> and has requested
              changes before signing.</p>
              <table style="border-collapse:collapse;margin:12px 0;">
                <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Contract No:</td><td><strong>${contract.contractNo}</strong></td></tr>
                <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Version:</td><td>v${contract.version}</td></tr>
                <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Received:</td><td>${stamp}</td></tr>
              </table>
              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:14px 16px;margin:16px 0;">
                <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px;">Owner's Feedback</div>
                <div style="color:#111827;white-space:pre-wrap;">${safeNotes}</div>
              </div>
              <p style="margin:24px 0;">
                <a href="${editUrl}" style="background:#E30613;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;display:inline-block;">
                  Review &amp; Update Contract
                </a>
              </p>
              <p style="color:#6b7280;font-size:12px;">After updating, re-send the agreement so
              the owner can review and sign the new version.</p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"/>
              <p style="color:#6b7280;font-size:12px;">Alwaan · Alwaan System · Dubai, UAE</p>
            </div>
          `,
          template: 'owner_change_request',
          refType: 'contract',
          refId: contract.id,
        })
      }
    } catch (e) {
      console.error('change-request admin email failed:', e)
    }

    return NextResponse.json({
      ok: true,
      message: 'Change request recorded',
    })
  } catch (error) {
    console.error('POST /api/sign/[token]/request-changes error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
