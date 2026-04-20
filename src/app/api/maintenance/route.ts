import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { createNotification } from '@/lib/notifications'
import { sendEmail } from '@/lib/email'

async function generateTicketNo(organizationId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `MT-${year}-`

  const lastTicket = await prisma.maintenanceTicket.findFirst({
    where: {
      organizationId,
      ticketNo: { startsWith: prefix },
    },
    orderBy: { ticketNo: 'desc' },
    select: { ticketNo: true },
  })

  let nextNum = 1
  if (lastTicket) {
    const lastNum = parseInt(lastTicket.ticketNo.replace(prefix, ''), 10)
    if (!isNaN(lastNum)) {
      nextNum = lastNum + 1
    }
  }

  return `${prefix}${nextNum.toString().padStart(4, '0')}`
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status')
    const priorityFilter = searchParams.get('priority')
    const tenantIdFilter = searchParams.get('tenant_id')
    const unitIdFilter = searchParams.get('unit_id')

    const where: Record<string, unknown> = { organizationId }
    if (statusFilter) where.status = statusFilter
    if (priorityFilter) where.priority = priorityFilter
    if (tenantIdFilter) where.tenantId = tenantIdFilter
    if (unitIdFilter) where.unitId = unitIdFilter

    const tickets = await prisma.maintenanceTicket.findMany({
      where,
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        unit: {
          select: {
            id: true,
            unitNo: true,
          },
        },
        vendor: {
          select: {
            id: true,
            companyName: true,
            contactPerson: true,
            phone: true,
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    })

    return NextResponse.json(tickets)
  } catch (error) {
    console.error('GET /api/maintenance error:', error)
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

    const {
      tenantId,
      unitId,
      category,
      priority,
      title,
      description,
      vendorId,
      estimatedCost,
    } = body

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      )
    }

    // Validate tenant belongs to org if provided
    if (tenantId) {
      const tenant = await prisma.tenant.findFirst({
        where: { id: tenantId, organizationId },
      })
      if (!tenant) {
        return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
      }
    }

    // Validate unit belongs to org if provided
    if (unitId) {
      const unit = await prisma.unit.findFirst({
        where: { id: unitId, organizationId },
      })
      if (!unit) {
        return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
      }
    }

    // Validate vendor belongs to org if provided
    if (vendorId) {
      const vendor = await prisma.vendor.findFirst({
        where: { id: vendorId, organizationId },
      })
      if (!vendor) {
        return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
      }
    }

    const ticketNo = await generateTicketNo(organizationId)
    const ticketPriority = priority || 'Medium'
    const isEmergency = ticketPriority === 'Emergency'

    const ticket = await prisma.maintenanceTicket.create({
      data: {
        organizationId,
        ticketNo,
        tenantId: tenantId || null,
        unitId: unitId || null,
        category: category || 'General',
        priority: ticketPriority,
        title,
        description: description || '',
        status: isEmergency ? 'Escalated' : 'Submitted',
        vendorId: vendorId || null,
        estimatedCost: estimatedCost ? parseFloat(estimatedCost) : 0,
      },
      include: {
        tenant: { select: { id: true, name: true } },
        unit: { select: { id: true, unitNo: true } },
        vendor: { select: { id: true, companyName: true } },
      },
    })

    // Notify admin/staff about new ticket
    await createNotification(
      organizationId,
      'staff',
      '',
      `New Maintenance Ticket: ${ticketNo}`,
      `${title}${isEmergency ? ' [EMERGENCY - AUTO ESCALATED]' : ''} - Priority: ${ticketPriority}`,
      'maintenance'
    )

    // If emergency, create additional escalation notification
    if (isEmergency) {
      await createNotification(
        organizationId,
        'staff',
        '',
        `EMERGENCY ESCALATION: ${ticketNo}`,
        `Emergency maintenance ticket auto-escalated. Title: ${title}. Immediate attention required.`,
        'maintenance'
      )
    }

    await logActivity(
      organizationId,
      session.user.name,
      'Created Maintenance Ticket',
      `Ticket ${ticketNo} created - ${title}${isEmergency ? ' [EMERGENCY]' : ''}`
    )

    // PM created this ticket FOR a tenant — email the tenant a work-order notice.
    if (ticket.tenant?.id) {
      const fullTenant = await prisma.tenant.findUnique({ where: { id: ticket.tenant.id }, select: { email: true, name: true } })
      if (fullTenant?.email) {
        const baseUrl = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '')
        const portalUrl = `${baseUrl}/tenant/maintenance`
        const safeName = (fullTenant.name || '').replace(/[<>]/g, '')
        const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,sans-serif;color:#111;">
          <div style="max-width:600px;margin:24px auto;padding:32px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;">
            <div style="height:4px;width:60px;background:#E30613;border-radius:2px;margin-bottom:18px;"></div>
            <h1 style="margin:0 0 12px 0;font-size:20px;">Maintenance Notice — ${ticketNo}</h1>
            <p>Dear ${safeName},</p>
            <p>Alwaan has scheduled / logged the following maintenance${ticket.unit?.unitNo ? ` for Unit ${ticket.unit.unitNo}` : ''}:</p>
            <table style="width:100%;border-collapse:collapse;margin:14px 0;">
              <tr style="background:#fafafa;"><td style="padding:8px 12px;font-size:12px;color:#6b7280;width:35%;border-bottom:1px solid #e5e7eb;">Title</td><td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #e5e7eb;font-weight:600;">${title.replace(/[<>]/g, '')}</td></tr>
              <tr><td style="padding:8px 12px;font-size:12px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Category</td><td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #e5e7eb;">${(category || 'General').replace(/[<>]/g, '')}</td></tr>
              <tr style="background:#fafafa;"><td style="padding:8px 12px;font-size:12px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Priority</td><td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #e5e7eb;${isEmergency ? 'color:#dc2626;font-weight:700;' : ''}">${ticketPriority}${isEmergency ? ' (Emergency)' : ''}</td></tr>
              ${description ? `<tr><td style="padding:8px 12px;font-size:12px;color:#6b7280;border-bottom:1px solid #e5e7eb;vertical-align:top;">Details</td><td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #e5e7eb;">${String(description).replace(/[<>]/g, '')}</td></tr>` : ''}
              ${ticket.vendor?.companyName ? `<tr style="background:#fafafa;"><td style="padding:8px 12px;font-size:12px;color:#6b7280;">Vendor</td><td style="padding:8px 12px;font-size:12px;">${ticket.vendor.companyName.replace(/[<>]/g, '')}</td></tr>` : ''}
            </table>
            <p style="text-align:center;margin:18px 0;">
              <a href="${portalUrl}" style="display:inline-block;background:#E30613;color:#fff;padding:10px 22px;border-radius:6px;text-decoration:none;font-weight:600;font-size:13px;">View / Reply in Portal</a>
            </p>
            <p style="margin:14px 0 0 0;font-size:11px;color:#6b7280;">For questions: <a href="mailto:info@alwaan.ae" style="color:#E30613;">info@alwaan.ae</a></p>
          </div>
        </body></html>`
        await sendEmail({
          organizationId,
          to: fullTenant.email,
          toName: fullTenant.name,
          subject: `Maintenance Notice — ${ticketNo}: ${title}`,
          html,
          template: 'maintenance_pm_to_tenant',
          triggeredBy: session.user.name,
          refType: 'tenant',
          refId: ticket.tenant.id,
        }).catch((e) => console.warn('Maintenance email to tenant failed:', e))
      }
    }

    return NextResponse.json(ticket, { status: 201 })
  } catch (error) {
    console.error('POST /api/maintenance error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
