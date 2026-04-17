import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { createNotification } from '@/lib/notifications'
import { sendEmail } from '@/lib/email'

const PENALTY_AMOUNTS: Record<string, number> = {
  'Parking Violation': 200,
  'Noise Complaint': 150,
  'Property Damage': 500,
  'Unauthorized Modification': 300,
  'Pet Policy Violation': 200,
  'Waste Disposal': 100,
  'Balcony Violation': 150,
  'Unauthorized Guest': 100,
  'General': 100,
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    const { searchParams } = new URL(request.url)
    const tenantIdFilter = searchParams.get('tenant_id')

    const where: Record<string, unknown> = { organizationId }
    if (tenantIdFilter) {
      where.tenantId = tenantIdFilter
    }

    const violations = await prisma.violation.findMany({
      where,
      include: {
        tenant: {
          select: { id: true, name: true, phone: true, email: true },
        },
        unit: {
          select: { id: true, unitNo: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(violations)
  } catch (error) {
    console.error('GET /api/violations error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    const body = await request.json()

    const { tenantId, unitId, type, description, evidence, severity, notes, fineAmount: bodyFine } = body

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 })
    }

    // Verify tenant belongs to organization
    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId, organizationId },
    })
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    // Verify unit if provided
    if (unitId) {
      const unit = await prisma.unit.findFirst({
        where: { id: unitId, organizationId },
      })
      if (!unit) {
        return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
      }
    }

    // Generate violation number: VIO-YYYY-NNNN
    const year = new Date().getFullYear()
    const count = await prisma.violation.count({
      where: {
        organizationId,
        violationNo: { startsWith: `VIO-${year}-` },
      },
    })
    const violationNo = `VIO-${year}-${String(count + 1).padStart(4, '0')}`

    // Use PM-entered fine; only fall back to PENALTY_AMOUNTS if PM didn't
    // provide one. PM can pass 0 or empty to issue a no-fine warning notice.
    const violationType = type || 'General'
    const fineAmount =
      bodyFine === undefined || bodyFine === null || bodyFine === ''
        ? 0
        : Number(bodyFine)

    // Check prior violations for auto-escalation
    const priorViolations = await prisma.violation.count({
      where: { organizationId, tenantId },
    })

    let finalSeverity = severity || 'Warning'
    if (priorViolations >= 3) {
      // Auto-escalate after 3+ violations
      finalSeverity = 'Critical'
    }

    const violation = await prisma.violation.create({
      data: {
        organizationId,
        violationNo,
        tenantId,
        unitId: unitId || null,
        type: violationType,
        description: description || '',
        evidence: evidence || '',
        severity: finalSeverity,
        fineAmount,
        status: 'Issued',
        issuedBy: session.user.name,
        notes: notes || '',
      },
      include: {
        tenant: { select: { id: true, name: true } },
        unit: { select: { id: true, unitNo: true } },
      },
    })

    // Notify tenant
    await createNotification(
      organizationId,
      'tenant',
      tenantId,
      `Violation Issued: ${violationNo}`,
      `Type: ${violationType} - Fine: AED ${fineAmount}${priorViolations >= 3 ? ' (ESCALATED - repeat offender)' : ''}`,
      'violation'
    )

    // Notify admin/staff
    await createNotification(
      organizationId,
      'staff',
      '',
      `Violation Issued: ${violationNo}`,
      `${violationType} against ${tenant.name} - AED ${fineAmount}${priorViolations >= 3 ? ' [ESCALATED]' : ''}`,
      'violation'
    )

    await logActivity(
      organizationId,
      session.user.name,
      'Issued Violation',
      `${violationNo}: ${violationType} against ${tenant.name} - AED ${fineAmount}`
    )

    // Email tenant the official violation notice
    try {
      const tenantFull = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { email: true, name: true },
      })
      if (tenantFull?.email) {
        const baseUrl = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '')
        const portalUrl = `${baseUrl}/tenant/violations`
        const safeName = (tenantFull.name || '').replace(/[<>]/g, '')
        const safeDesc = (description || '').replace(/[<>]/g, '')
        const isCritical = finalSeverity === 'Critical'
        const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,sans-serif;color:#111;">
          <div style="max-width:620px;margin:24px auto;padding:32px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;">
            <div style="border-bottom:3px solid ${isCritical ? '#dc2626' : '#E30613'};padding-bottom:14px;margin-bottom:18px;">
              <h1 style="margin:0;font-size:22px;color:${isCritical ? '#dc2626' : '#E30613'};">${isCritical ? '🚨 ' : ''}Violation Notice — ${violationNo}</h1>
              <p style="margin:4px 0 0 0;font-size:12px;color:#6b7280;">CRE L.L.C. · ${new Date().toLocaleDateString('en-GB')}</p>
            </div>
            <p>Dear ${safeName},</p>
            <p>CRE has issued the following violation notice${unitId ? ` for your unit` : ''}:</p>
            <table style="width:100%;border-collapse:collapse;margin:14px 0;">
              <tr style="background:#fafafa;"><td style="padding:8px 12px;font-size:12px;color:#6b7280;width:35%;border-bottom:1px solid #e5e7eb;">Type</td><td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #e5e7eb;font-weight:600;">${violationType}</td></tr>
              <tr><td style="padding:8px 12px;font-size:12px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Severity</td><td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #e5e7eb;${isCritical ? 'color:#dc2626;font-weight:700;' : ''}">${finalSeverity}${priorViolations >= 3 ? ' (auto-escalated — repeat offender)' : ''}</td></tr>
              ${safeDesc ? `<tr style="background:#fafafa;"><td style="padding:8px 12px;font-size:12px;color:#6b7280;border-bottom:1px solid #e5e7eb;vertical-align:top;">Details</td><td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #e5e7eb;">${safeDesc}</td></tr>` : ''}
              ${fineAmount > 0 ? `<tr><td style="padding:8px 12px;font-size:12px;color:#6b7280;">Fine Amount</td><td style="padding:8px 12px;font-size:18px;font-weight:700;color:#E30613;">AED ${fineAmount.toLocaleString()}</td></tr>` : ''}
            </table>
            <div style="margin:18px 0;padding:14px;background:#fff5f5;border-left:4px solid #E30613;border-radius:4px;font-size:13px;">
              <strong>Action required:</strong> Please log in to your portal to acknowledge this notice${fineAmount > 0 ? ' and arrange payment of the fine within 14 days' : ''}. Continued or repeat violations may result in escalation under your tenancy contract.
            </div>
            <p style="text-align:center;margin:18px 0;">
              <a href="${portalUrl}" style="display:inline-block;background:#E30613;color:#fff;padding:10px 22px;border-radius:6px;text-decoration:none;font-weight:600;font-size:13px;">View &amp; Acknowledge</a>
            </p>
            <p style="margin:14px 0 0 0;font-size:11px;color:#6b7280;">For any disputes contact <a href="mailto:info@cre.ae" style="color:#E30613;">info@cre.ae</a> within 7 days.</p>
          </div>
        </body></html>`
        await sendEmail({
          organizationId,
          to: tenantFull.email,
          toName: tenantFull.name,
          subject: `${isCritical ? '🚨 ' : ''}Violation Notice — ${violationNo} (${violationType})`,
          html,
          template: 'violation_notice',
          triggeredBy: session.user.name,
          refType: 'tenant',
          refId: tenantId,
        }).catch((e) => console.warn('Violation email failed:', e))
      }
    } catch (e) {
      console.warn('Violation email pipeline failed:', e)
    }

    return NextResponse.json(violation, { status: 201 })
  } catch (error) {
    console.error('POST /api/violations error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
