import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { createNotification } from '@/lib/notifications'
import { logActivity } from '@/lib/activity'

/**
 * Sends the fully-executed "final package" email to the owner:
 *   1. The signed PM Agreement (HTML contract route)
 *   2. The official DLD stamped PDF
 */
export async function POST(
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

    const owner = await prisma.propertyOwner.findFirst({
      where: { id, organizationId },
    })
    if (!owner) {
      return NextResponse.json({ error: 'Owner not found' }, { status: 404 })
    }
    if (!owner.email) {
      return NextResponse.json(
        { error: 'Owner has no email on file' },
        { status: 400 }
      )
    }

    // Latest signed (Active or Signed) contract
    const contract = await prisma.ownerContract.findFirst({
      where: {
        organizationId,
        ownerId: id,
        status: { in: ['Active', 'Signed'] },
      },
      orderBy: { version: 'desc' },
    })
    if (!contract) {
      return NextResponse.json(
        { error: 'No signed contract available for this owner' },
        { status: 400 }
      )
    }

    const baseUrl = process.env.NEXTAUTH_URL || ''
    const pmUrl = `${baseUrl}/api/owners/${id}/contract`
    const dldUrl = `${baseUrl}/api/owners/${id}/dld/download`
    const buildingName = owner.buildingName || 'your property'
    const ownerName = owner.ownerName || 'Valued Owner'

    const subject = `Final Agreement Package — ${buildingName}`

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:28px;background:#ffffff;color:#111827;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="display:inline-block;background:#E30613;color:#ffffff;font-weight:700;letter-spacing:0.04em;padding:10px 18px;border-radius:6px;">
            CONTINENTAL REAL ESTATE
          </div>
        </div>

        <h1 style="font-size:22px;color:#111827;margin:0 0 14px 0;">Your Final Agreement Package</h1>
        <p style="margin:0 0 12px 0;">Dear ${ownerName},</p>
        <p style="margin:0 0 16px 0;line-height:1.55;">
          Here is the fully-executed package for your records for
          <strong>${buildingName}</strong>:
        </p>

        <ol style="padding-left:20px;margin:0 0 22px 0;line-height:1.7;">
          <li><strong>PM Agreement</strong> — signed by all parties.</li>
          <li><strong>DLD Contract</strong> — official stamped copy from Dubai Land Department.</li>
        </ol>

        <table role="presentation" cellspacing="0" cellpadding="0" style="margin:10px 0 22px 0;">
          <tr>
            <td style="padding-right:10px;">
              <a href="${pmUrl}"
                 style="background:#E30613;color:#ffffff;padding:12px 22px;text-decoration:none;border-radius:6px;font-weight:600;display:inline-block;">
                Download PM Agreement
              </a>
            </td>
            <td>
              <a href="${dldUrl}"
                 style="background:#111827;color:#ffffff;padding:12px 22px;text-decoration:none;border-radius:6px;font-weight:600;display:inline-block;">
                Download DLD Contract
              </a>
            </td>
          </tr>
        </table>

        <p style="margin:0 0 14px 0;line-height:1.55;">
          Please keep these documents for your records. If you have any questions
          or need additional copies, simply reply to this email and our team will
          be happy to help.
        </p>

        <p style="margin:18px 0 4px 0;">Kind regards,</p>
        <p style="margin:0 0 22px 0;"><strong>CRE</strong><br/>
        <span style="color:#6b7280;font-size:13px;">Property Management · Dubai, UAE</span></p>

        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"/>
        <p style="color:#9ca3af;font-size:12px;margin:0;">
          Contract No: ${contract.contractNo} v${contract.version}<br/>
          This email was sent by CRE. Replies go to info@cre.ae.
        </p>
      </div>
    `

    const result = await sendEmail({
      organizationId,
      to: owner.email,
      toName: owner.ownerName,
      subject,
      html,
      template: 'final_package',
      triggeredBy: session.user.name,
      refType: 'owner',
      refId: id,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: `Email send failed: ${result.error || 'unknown error'}` },
        { status: 502 }
      )
    }

    await createNotification(
      organizationId,
      'staff',
      '',
      'Final Package Sent',
      `Final agreement package emailed to ${owner.ownerName} (${owner.email})`,
      'system'
    )

    try {
      await logActivity(
        organizationId,
        session.user.name,
        'Sent Final Agreement Package',
        `${owner.ownerName} <${owner.email}> – ${buildingName} – ${contract.contractNo} v${contract.version}`
      )
    } catch (e) {
      console.error('logActivity failed:', e)
    }

    return NextResponse.json({
      ok: true,
      message: `Final package emailed to ${owner.email}`,
    })
  } catch (error) {
    console.error('POST /api/owners/[id]/send-final-package error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
