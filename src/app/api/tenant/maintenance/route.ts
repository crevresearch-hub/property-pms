import { NextRequest, NextResponse } from 'next/server'
import { getTenantSession } from '@/lib/tenant-auth'
import prisma from '@/lib/prisma'
import { createNotification } from '@/lib/notifications'
import { sendEmail } from '@/lib/email'

export async function GET(request: NextRequest) {
  const session = getTenantSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const tickets = await prisma.maintenanceTicket.findMany({
      where: { tenantId: session.id, organizationId: session.orgId },
      include: {
        unit: { select: { unitNo: true } },
        vendor: { select: { companyName: true, contactPerson: true, phone: true } },
        comments: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
      orderBy: { submittedAt: 'desc' },
    })

    return NextResponse.json(tickets)
  } catch (error) {
    console.error('GET /api/tenant/maintenance error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = getTenantSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { category, priority, title, description } = await request.json()

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    // Get tenant's unit
    const unit = await prisma.unit.findFirst({
      where: { tenantId: session.id, organizationId: session.orgId },
    })

    // Generate ticket number
    const count = await prisma.maintenanceTicket.count({
      where: { organizationId: session.orgId },
    })
    const ticketNo = `MT-${String(count + 1).padStart(5, '0')}`

    const ticket = await prisma.maintenanceTicket.create({
      data: {
        organizationId: session.orgId,
        ticketNo,
        tenantId: session.id,
        unitId: unit?.id || null,
        category: category || 'General',
        priority: priority || 'Medium',
        title,
        description: description || '',
        status: 'Submitted',
      },
      include: {
        unit: { select: { unitNo: true } },
      },
    })

    // Notify staff (in-app)
    await createNotification(
      session.orgId,
      'staff',
      '',
      `New Maintenance Request: ${ticketNo}`,
      `${session.name} submitted: ${title}`,
      'maintenance'
    )

    // Email all admin staff
    try {
      const admins = await prisma.user.findMany({
        where: { organizationId: session.orgId, role: 'admin', isActive: true },
        select: { email: true, name: true },
      })
      const baseUrl = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '')
      const safeTitle = String(title).replace(/[<>]/g, '')
      const safeDesc = String(description || '').replace(/[<>]/g, '')
      const safeName = session.name.replace(/[<>]/g, '')
      const isEmergency = (priority || 'Medium') === 'Emergency'
      const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,sans-serif;color:#111;">
        <div style="max-width:600px;margin:24px auto;padding:32px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;">
          <div style="height:4px;width:60px;background:${isEmergency ? '#dc2626' : '#E30613'};border-radius:2px;margin-bottom:18px;"></div>
          <h1 style="margin:0 0 12px 0;font-size:20px;${isEmergency ? 'color:#dc2626;' : ''}">${isEmergency ? '🚨 EMERGENCY ' : ''}New Maintenance Request — ${ticketNo}</h1>
          <p>${safeName} submitted a maintenance request${unit?.unitNo ? ` for Unit ${unit.unitNo}` : ''}.</p>
          <table style="width:100%;border-collapse:collapse;margin:14px 0;">
            <tr style="background:#fafafa;"><td style="padding:8px 12px;font-size:12px;color:#6b7280;width:35%;border-bottom:1px solid #e5e7eb;">Title</td><td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #e5e7eb;font-weight:600;">${safeTitle}</td></tr>
            <tr><td style="padding:8px 12px;font-size:12px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Category</td><td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #e5e7eb;">${(category || 'General').replace(/[<>]/g, '')}</td></tr>
            <tr style="background:#fafafa;"><td style="padding:8px 12px;font-size:12px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Priority</td><td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #e5e7eb;${isEmergency ? 'color:#dc2626;font-weight:700;' : ''}">${priority || 'Medium'}</td></tr>
            ${safeDesc ? `<tr><td style="padding:8px 12px;font-size:12px;color:#6b7280;border-bottom:1px solid #e5e7eb;vertical-align:top;">Details</td><td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #e5e7eb;">${safeDesc}</td></tr>` : ''}
          </table>
          <p style="text-align:center;margin:18px 0;">
            <a href="${baseUrl}/dashboard/maintenance" style="display:inline-block;background:#E30613;color:#fff;padding:10px 22px;border-radius:6px;text-decoration:none;font-weight:600;font-size:13px;">Open Ticket</a>
          </p>
        </div>
      </body></html>`
      for (const a of admins) {
        if (!a.email) continue
        await sendEmail({
          organizationId: session.orgId,
          to: a.email,
          toName: a.name,
          subject: `${isEmergency ? '🚨 EMERGENCY ' : ''}Maintenance: ${ticketNo} — ${safeTitle}`,
          html,
          template: 'maintenance_tenant_to_pm',
          triggeredBy: session.name,
          refType: 'tenant',
          refId: session.id,
        }).catch((e) => console.warn('Maintenance email to admin failed:', e))
      }
    } catch (e) {
      console.warn('Tenant→PM email pipeline failed:', e)
    }

    return NextResponse.json(ticket, { status: 201 })
  } catch (error) {
    console.error('POST /api/tenant/maintenance error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
