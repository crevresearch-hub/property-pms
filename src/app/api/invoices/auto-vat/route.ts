import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { createVatInvoice } from '@/lib/vat-invoice'
import { buildVatInvoiceHTML } from '@/lib/vat-invoice-html'
import { sendEmail } from '@/lib/email'

interface Body {
  tenantId: string
  unitId?: string | null
  type: string
  baseAmount: number
  vatRate?: number
  paymentDate: string
  notes?: string
  sendEmail?: boolean
  // Idempotency key — we tag the resulting invoice's notes with SOURCE:<ref>
  // and skip creating a duplicate if one already exists.
  sourceRef?: string
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const organizationId = session.user.organizationId
    const body = (await request.json()) as Body

    if (!body.tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 })
    if (!body.baseAmount || body.baseAmount <= 0) return NextResponse.json({ error: 'baseAmount required' }, { status: 400 })

    const tenant = await prisma.tenant.findFirst({
      where: { id: body.tenantId, organizationId },
      include: { units: { select: { id: true, unitNo: true, unitType: true } } },
    })
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    // Idempotency — skip if an invoice with this sourceRef already exists
    if (body.sourceRef) {
      const existing = await prisma.invoice.findFirst({
        where: { organizationId, notes: { contains: `SOURCE:${body.sourceRef}` } },
      })
      if (existing) {
        return NextResponse.json({ invoice: existing, deduped: true }, { status: 200 })
      }
    }

    let unit = null as null | { id: string; unitNo: string; unitType: string }
    if (body.unitId) {
      unit = await prisma.unit.findFirst({
        where: { id: body.unitId, organizationId },
        select: { id: true, unitNo: true, unitType: true },
      })
    }
    if (!unit && tenant.units?.[0]) {
      unit = tenant.units[0]
    }

    const noteParts: string[] = []
    if (body.notes) noteParts.push(body.notes)
    if (body.sourceRef) noteParts.push(`SOURCE:${body.sourceRef}`)
    const invoice = await createVatInvoice({
      organizationId,
      tenantId: tenant.id,
      unitId: unit?.id || null,
      unitNo: unit?.unitNo || 'NA',
      type: body.type,
      baseAmount: body.baseAmount,
      vatRate: body.vatRate,
      paymentDate: body.paymentDate,
      notes: noteParts.join('\n'),
      createdBy: session.user.name,
    })

    await logActivity(
      organizationId,
      session.user.name,
      'Auto-Generated VAT Invoice',
      `${invoice.invoiceNo} · ${body.type} · AED ${invoice.totalAmount.toLocaleString()} for ${tenant.name}`
    )

    // Email the invoice to the tenant
    if (body.sendEmail !== false && tenant.email) {
      const baseUrl = process.env.NEXTAUTH_URL || ''
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true, address: true, logo: true, phone: true, email: true },
      })
      const tc = unit?.id
        ? await prisma.tenancyContract.findFirst({
            where: { organizationId, unitId: unit.id },
            orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
            select: { ownerId: true },
          })
        : null
      const owner = tc?.ownerId
        ? await prisma.propertyOwner.findUnique({
            where: { id: tc.ownerId },
            select: { ownerName: true, buildingName: true, address: true, iban: true, bankName: true, email: true, phone: true, tradeLicense: true },
          })
        : null
      const html = buildVatInvoiceHTML({
        invoice: { ...invoice, notes: invoice.notes || '' },
        tenant: { name: tenant.name, email: tenant.email, phone: tenant.phone, emiratesId: tenant.emiratesId },
        unit: { unitNo: unit?.unitNo || '', unitType: unit?.unitType },
        owner,
        organization: {
          name: org?.name || 'Alwaan',
          address: org?.address,
          logo: org?.logo,
          phone: org?.phone,
          email: org?.email,
        },
      })
      const portalUrl = `${baseUrl.replace(/\/$/, '')}/api/invoices/${invoice.id}?format=html`
      const wrapped = `
        <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px;color:#111;">
          <h2 style="color:#E30613;">Tax Invoice — ${invoice.invoiceNo}</h2>
          <p>Dear ${tenant.name.replace(/[<>]/g, '')},</p>
          <p>Attached below is your VAT invoice for <strong>${body.type}</strong>.</p>
          <p style="margin:20px 0;">
            <a href="${portalUrl}" style="display:inline-block;background:#E30613;color:#fff;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:600;">View / Print Invoice</a>
          </p>
          <hr/>
          ${html}
        </div>`
      await sendEmail({
        organizationId,
        to: tenant.email,
        toName: tenant.name,
        subject: `Tax Invoice ${invoice.invoiceNo} — ${body.type}`,
        html: wrapped,
        template: 'vat_invoice',
        triggeredBy: session.user.name,
        refType: 'invoice',
        refId: invoice.id,
      }).catch((e) => console.warn('VAT invoice email failed:', e))
    }

    return NextResponse.json({ invoice }, { status: 201 })
  } catch (error) {
    console.error('POST /api/invoices/auto-vat error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
