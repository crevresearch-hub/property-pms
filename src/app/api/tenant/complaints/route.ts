import { NextRequest, NextResponse } from 'next/server'
import { getTenantSession } from '@/lib/tenant-auth'
import prisma from '@/lib/prisma'
import { createNotification } from '@/lib/notifications'
import { sendEmail } from '@/lib/email'

async function nextComplaintNo(organizationId: string) {
  const year = new Date().getFullYear()
  const prefix = `CMP-${year}-`
  const last = await prisma.complaint.findFirst({
    where: { organizationId, complaintNo: { startsWith: prefix } },
    orderBy: { complaintNo: 'desc' },
    select: { complaintNo: true },
  })
  let next = 1
  if (last) {
    const tail = last.complaintNo.slice(prefix.length)
    const n = parseInt(tail, 10)
    if (!Number.isNaN(n)) next = n + 1
  }
  return `${prefix}${String(next).padStart(4, '0')}`
}

export async function GET(request: NextRequest) {
  const session = getTenantSession(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const complaints = await prisma.complaint.findMany({
      where: { tenantId: session.id, organizationId: session.orgId },
      include: { unit: { select: { unitNo: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(complaints)
  } catch (error) {
    console.error('GET /api/tenant/complaints error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = getTenantSession(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = (await request.json().catch(() => ({}))) as {
      category?: string
      subject?: string
      description?: string
      priority?: string
    }
    if (!body.subject || body.subject.trim().length < 3) {
      return NextResponse.json({ error: 'Subject is required' }, { status: 400 })
    }

    const unit = await prisma.unit.findFirst({
      where: { tenantId: session.id, organizationId: session.orgId },
      select: { id: true, unitNo: true },
    })
    const complaintNo = await nextComplaintNo(session.orgId)

    const complaint = await prisma.complaint.create({
      data: {
        organizationId: session.orgId,
        complaintNo,
        tenantId: session.id,
        unitId: unit?.id || null,
        category: body.category || 'General',
        subject: body.subject.trim(),
        description: (body.description || '').trim(),
        priority: body.priority || 'Medium',
        status: 'Open',
      },
    })

    await createNotification(
      session.orgId,
      'staff',
      '',
      `New Complaint: ${complaintNo}`,
      `${session.name}${unit?.unitNo ? ` (Unit ${unit.unitNo})` : ''}: ${body.subject}`,
      'complaint'
    )

    // Email admin staff
    try {
      const admins = await prisma.user.findMany({
        where: { organizationId: session.orgId, role: 'admin', isActive: true },
        select: { email: true, name: true },
      })
      const baseUrl = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '')
      const safeName = session.name.replace(/[<>]/g, '')
      const safeSubject = body.subject.replace(/[<>]/g, '')
      const safeDesc = (body.description || '').replace(/[<>]/g, '')
      const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,sans-serif;color:#111;">
        <div style="max-width:600px;margin:24px auto;padding:32px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;">
          <div style="height:4px;width:60px;background:#E30613;border-radius:2px;margin-bottom:18px;"></div>
          <h1 style="margin:0 0 12px 0;font-size:20px;">New Tenant Complaint — ${complaintNo}</h1>
          <p>${safeName} filed a complaint${unit?.unitNo ? ` for Unit ${unit.unitNo}` : ''}:</p>
          <table style="width:100%;border-collapse:collapse;margin:14px 0;">
            <tr style="background:#fafafa;"><td style="padding:8px 12px;font-size:12px;color:#6b7280;width:30%;border-bottom:1px solid #e5e7eb;">Subject</td><td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #e5e7eb;font-weight:600;">${safeSubject}</td></tr>
            <tr><td style="padding:8px 12px;font-size:12px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Category</td><td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #e5e7eb;">${(body.category || 'General').replace(/[<>]/g, '')}</td></tr>
            <tr style="background:#fafafa;"><td style="padding:8px 12px;font-size:12px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Priority</td><td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #e5e7eb;">${(body.priority || 'Medium').replace(/[<>]/g, '')}</td></tr>
            ${safeDesc ? `<tr><td style="padding:8px 12px;font-size:12px;color:#6b7280;border-bottom:1px solid #e5e7eb;vertical-align:top;">Details</td><td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #e5e7eb;">${safeDesc}</td></tr>` : ''}
          </table>
          <p style="text-align:center;margin:18px 0;">
            <a href="${baseUrl}/dashboard/complaints" style="display:inline-block;background:#E30613;color:#fff;padding:10px 22px;border-radius:6px;text-decoration:none;font-weight:600;font-size:13px;">Open Complaint</a>
          </p>
        </div>
      </body></html>`
      for (const a of admins) {
        if (!a.email) continue
        await sendEmail({
          organizationId: session.orgId,
          to: a.email,
          toName: a.name,
          subject: `New Complaint: ${complaintNo} — ${safeSubject}`,
          html,
          template: 'complaint_tenant_to_pm',
          triggeredBy: session.name,
          refType: 'tenant',
          refId: session.id,
        }).catch((e) => console.warn('Complaint email failed:', e))
      }
    } catch (e) {
      console.warn('Complaint email pipeline failed:', e)
    }

    return NextResponse.json(complaint, { status: 201 })
  } catch (error) {
    console.error('POST /api/tenant/complaints error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
