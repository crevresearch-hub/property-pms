import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { logActivity } from '@/lib/activity'

/**
 * Owner monthly statement.
 *
 * Data model note: the current schema does not link Unit -> PropertyOwner, so
 * for single-building organizations the statement covers all units in the org.
 * A future enhancement is to filter by a building identifier.
 *
 * Query params:
 *   ?month=YYYY-MM (default: current month)
 */

interface StatementData {
  owner: {
    id: string
    ownerName: string
    email: string
    buildingName: string
    iban: string
    bankName: string
    managementFee: number
    maintenanceMarkup: number
  }
  month: string // YYYY-MM
  periodLabel: string
  rentCollected: number
  otherIncome: number
  maintenanceExpenses: number
  managementCommission: number
  maintenanceMarkupAmount: number
  netPayable: number
  invoices: { invoiceNo: string; tenantName: string; unitNo: string; amount: number; type: string; paidAt: string }[]
  maintenance: { workOrderNo: string; vendorName: string; description: string; amount: number }[]
  generatedAt: string
}

function monthRange(monthStr: string): { start: Date; end: Date; label: string } {
  const [y, m] = monthStr.split('-').map((n) => parseInt(n, 10))
  const start = new Date(Date.UTC(y, m - 1, 1))
  const end = new Date(Date.UTC(y, m, 1))
  const label = start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  return { start, end, label }
}

async function computeStatement(
  organizationId: string,
  ownerId: string,
  monthStr: string
): Promise<StatementData | null> {
  const owner = await prisma.propertyOwner.findFirst({
    where: { id: ownerId, organizationId },
  })
  if (!owner) return null

  const { start, end, label } = monthRange(monthStr)
  const startStr = start.toISOString().slice(0, 10)
  const endStr = end.toISOString().slice(0, 10)

  // Payments received this month (indicates rent collected)
  const payments = await prisma.payment.findMany({
    where: {
      organizationId,
      paymentDate: { gte: startStr, lt: endStr },
    },
    include: {
      invoice: {
        include: {
          tenant: { select: { name: true } },
          unit: { select: { unitNo: true } },
        },
      },
    },
  })

  let rentCollected = 0
  let otherIncome = 0
  const invoices: StatementData['invoices'] = []

  for (const p of payments) {
    const inv = p.invoice
    const amt = p.amount
    if ((inv.type || '').toLowerCase() === 'rent') rentCollected += amt
    else otherIncome += amt
    invoices.push({
      invoiceNo: inv.invoiceNo,
      tenantName: inv.tenant?.name || '—',
      unitNo: inv.unit?.unitNo || '—',
      amount: amt,
      type: inv.type,
      paidAt: p.paymentDate,
    })
  }

  // Maintenance work orders completed/paid this month
  const workOrders = await prisma.workOrder.findMany({
    where: {
      organizationId,
      actualCompletion: { gte: startStr, lt: endStr, not: '' },
    },
    include: { vendor: { select: { companyName: true } } },
  })

  let maintenanceExpenses = 0
  const maintenance: StatementData['maintenance'] = []
  for (const w of workOrders) {
    const amt = w.actualAmount || w.estimatedAmount || 0
    maintenanceExpenses += amt
    maintenance.push({
      workOrderNo: w.workOrderNo,
      vendorName: w.vendor?.companyName || '—',
      description: w.scopeOfWork || '',
      amount: amt,
    })
  }

  const totalIncome = rentCollected + otherIncome
  const managementCommission = +(totalIncome * (owner.managementFee || 0) / 100).toFixed(2)
  const maintenanceMarkupAmount = +(maintenanceExpenses * (owner.maintenanceMarkup || 0) / 100).toFixed(2)
  const netPayable = +(totalIncome - managementCommission - maintenanceExpenses - maintenanceMarkupAmount).toFixed(2)

  return {
    owner: {
      id: owner.id,
      ownerName: owner.ownerName,
      email: owner.email,
      buildingName: owner.buildingName,
      iban: owner.iban,
      bankName: owner.bankName,
      managementFee: owner.managementFee,
      maintenanceMarkup: owner.maintenanceMarkup,
    },
    month: monthStr,
    periodLabel: label,
    rentCollected,
    otherIncome,
    maintenanceExpenses,
    managementCommission,
    maintenanceMarkupAmount,
    netPayable,
    invoices,
    maintenance,
    generatedAt: new Date().toISOString(),
  }
}

function fmtAED(n: number): string {
  return `AED ${n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function buildStatementHTML(s: StatementData, baseUrl: string): string {
  const logoUrl = ""
  const invoiceRows = s.invoices
    .map(
      (i) => `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${i.invoiceNo}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${i.tenantName}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${i.unitNo}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${i.type}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${fmtAED(i.amount)}</td>
      </tr>`
    )
    .join('')
  const mxRows = s.maintenance
    .map(
      (m) => `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${m.workOrderNo}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${m.vendorName}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${m.description}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${fmtAED(m.amount)}</td>
      </tr>`
    )
    .join('')

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#111;">
  <div style="max-width:720px;margin:24px auto;padding:32px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;">
    <div style="text-align:center;margin-bottom:16px;">
      <img src="${logoUrl}" alt="Alwaan" style="height:48px;" />
    </div>
    <h1 style="margin:0 0 6px 0;font-size:22px;">Monthly Statement — ${s.periodLabel}</h1>
    <p style="margin:0 0 18px 0;color:#6b7280;font-size:13px;">
      ${s.owner.buildingName} · Prepared for ${s.owner.ownerName}
    </p>

    <table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:13px;">
      <tr><td style="padding:8px 10px;background:#fafafa;color:#6b7280;">Rent Collected</td><td style="padding:8px 10px;text-align:right;">${fmtAED(s.rentCollected)}</td></tr>
      <tr><td style="padding:8px 10px;background:#fafafa;color:#6b7280;">Other Income</td><td style="padding:8px 10px;text-align:right;">${fmtAED(s.otherIncome)}</td></tr>
      <tr><td style="padding:8px 10px;background:#fafafa;color:#6b7280;">Maintenance Expenses</td><td style="padding:8px 10px;text-align:right;color:#b45309;">− ${fmtAED(s.maintenanceExpenses)}</td></tr>
      <tr><td style="padding:8px 10px;background:#fafafa;color:#6b7280;">Maintenance Markup (${s.owner.maintenanceMarkup}%)</td><td style="padding:8px 10px;text-align:right;color:#b45309;">− ${fmtAED(s.maintenanceMarkupAmount)}</td></tr>
      <tr><td style="padding:8px 10px;background:#fafafa;color:#6b7280;">CRE Management Commission (${s.owner.managementFee}%)</td><td style="padding:8px 10px;text-align:right;color:#b45309;">− ${fmtAED(s.managementCommission)}</td></tr>
      <tr><td style="padding:12px 10px;border-top:2px solid #111;font-weight:700;">Net Payable to Owner</td><td style="padding:12px 10px;border-top:2px solid #111;text-align:right;font-weight:700;color:#059669;font-size:16px;">${fmtAED(s.netPayable)}</td></tr>
    </table>

    ${s.owner.iban ? `<div style="margin:18px 0;padding:12px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;font-size:13px;">
      <strong>Transfer Details</strong><br/>
      Bank: ${s.owner.bankName || '—'}<br/>
      IBAN: ${s.owner.iban}
    </div>` : ''}

    ${invoiceRows ? `<h3 style="margin:20px 0 6px 0;font-size:14px;">Income Details</h3>
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead><tr style="background:#f4f5f7;"><th style="padding:6px 10px;text-align:left;">Invoice</th><th style="padding:6px 10px;text-align:left;">Tenant</th><th style="padding:6px 10px;text-align:left;">Unit</th><th style="padding:6px 10px;text-align:left;">Type</th><th style="padding:6px 10px;text-align:right;">Amount</th></tr></thead>
      <tbody>${invoiceRows}</tbody>
    </table>` : ''}

    ${mxRows ? `<h3 style="margin:20px 0 6px 0;font-size:14px;">Maintenance Details</h3>
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead><tr style="background:#f4f5f7;"><th style="padding:6px 10px;text-align:left;">WO</th><th style="padding:6px 10px;text-align:left;">Vendor</th><th style="padding:6px 10px;text-align:left;">Description</th><th style="padding:6px 10px;text-align:right;">Amount</th></tr></thead>
      <tbody>${mxRows}</tbody>
    </table>` : ''}

    <p style="margin:24px 0 0 0;font-size:11px;color:#6b7280;">
      Generated ${new Date(s.generatedAt).toLocaleString('en-GB')} · CRE
    </p>
  </div>
</body></html>`
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const organizationId = session.user.organizationId
    const { id } = await params
    const monthStr =
      request.nextUrl.searchParams.get('month') ||
      new Date().toISOString().slice(0, 7)

    const data = await computeStatement(organizationId, id, monthStr)
    if (!data) return NextResponse.json({ error: 'Owner not found' }, { status: 404 })

    if (request.nextUrl.searchParams.get('format') === 'html') {
      const html = buildStatementHTML(data, process.env.NEXTAUTH_URL || '')
      return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('GET /api/owners/[id]/monthly-statement error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const organizationId = session.user.organizationId
    const { id } = await params
    const body = (await request.json().catch(() => ({}))) as { month?: string }
    const monthStr = body.month || new Date().toISOString().slice(0, 7)

    const data = await computeStatement(organizationId, id, monthStr)
    if (!data) return NextResponse.json({ error: 'Owner not found' }, { status: 404 })

    if (!data.owner.email) {
      return NextResponse.json({ error: 'Owner has no email on file' }, { status: 400 })
    }

    const html = buildStatementHTML(data, process.env.NEXTAUTH_URL || '')
    const result = await sendEmail({
      organizationId,
      to: data.owner.email,
      toName: data.owner.ownerName,
      subject: `Monthly Statement — ${data.periodLabel} — ${data.owner.buildingName}`,
      html,
      template: 'owner_monthly_statement',
      triggeredBy: session.user.name,
      refType: 'owner',
      refId: id,
    })

    await logActivity(
      organizationId,
      session.user.name,
      'Sent Monthly Statement',
      `${data.periodLabel} statement emailed to ${data.owner.ownerName}`
    )

    return NextResponse.json({
      success: result.success,
      message: result.success
        ? `Statement emailed to ${data.owner.email}`
        : `Send failed: ${result.error}`,
      data,
    })
  } catch (error) {
    console.error('POST /api/owners/[id]/monthly-statement error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
