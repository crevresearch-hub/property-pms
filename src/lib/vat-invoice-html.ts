interface InvoiceLike {
  invoiceNo: string
  type: string
  amount: number
  vatAmount: number
  totalAmount: number
  dueDate: string
  notes: string
  status?: string
  createdAt: Date | string
}
interface TenantLike {
  name: string
  email?: string
  phone?: string
  emiratesId?: string
}
interface UnitLike {
  unitNo: string
  unitType?: string
}
interface OwnerLike {
  ownerName?: string
  buildingName?: string
  address?: string
  iban?: string
  bankName?: string
  email?: string
  phone?: string
  tradeLicense?: string
}

const BRAND_RED = '#E30613'
const TEXT_DARK = '#111111'

function esc(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch))
}
function fmtAed(n: number): string {
  return `AED ${(n || 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—'
  const dt = typeof d === 'string' ? new Date(d) : d
  if (Number.isNaN(dt.getTime())) return String(d)
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function buildVatInvoiceHTML(opts: {
  invoice: InvoiceLike
  tenant: TenantLike
  unit: UnitLike
  owner?: OwnerLike | null
  organization: { name: string; address?: string | null; logo?: string | null; phone?: string | null; email?: string | null }
}): string {
  const { invoice, tenant, unit, owner, organization } = opts
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Tax Invoice ${esc(invoice.invoiceNo)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; color: ${TEXT_DARK}; background: #fff; margin: 0; }
  .wrap { max-width: 760px; margin: 0 auto; padding: 28px; }
  .head { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 4px solid ${BRAND_RED}; padding-bottom: 16px; margin-bottom: 22px; }
  .org h1 { color: ${BRAND_RED}; font-size: 24px; margin: 0 0 4px 0; letter-spacing: 0.5px; }
  .org p { font-size: 11px; color: #555; margin: 1px 0; }
  .doc { text-align: right; }
  .doc h2 { color: ${TEXT_DARK}; font-size: 18px; margin: 0 0 6px 0; text-transform: uppercase; letter-spacing: 1px; }
  .doc .num { font-family: ui-monospace, SFMono-Regular, monospace; font-size: 13px; color: ${BRAND_RED}; font-weight: 700; margin-top: 2px; }
  .doc .date { font-size: 11px; color: #555; margin-top: 4px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 22px; }
  .meta .box { border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; }
  .meta h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin: 0 0 6px 0; }
  .meta p { margin: 2px 0; font-size: 12px; }
  .meta .name { font-weight: 700; font-size: 13px; }
  table.items { width: 100%; border-collapse: collapse; margin: 14px 0; }
  table.items th { background: #f3f4f6; padding: 8px 10px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #374151; border-bottom: 2px solid #d1d5db; }
  table.items th.r, table.items td.r { text-align: right; }
  table.items td { padding: 10px; font-size: 12px; border-bottom: 1px solid #e5e7eb; }
  table.items tfoot td { padding: 8px 10px; font-size: 12px; }
  table.items tfoot tr.subtotal td { color: #555; }
  table.items tfoot tr.total td { background: ${BRAND_RED}; color: #fff; font-weight: 700; font-size: 14px; border-radius: 4px; }
  .footer { margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 12px; font-size: 10px; color: #6b7280; text-align: center; }
  .stamp { display: inline-block; padding: 4px 10px; border: 1.5px solid #16a34a; color: #16a34a; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; border-radius: 4px; margin-top: 4px; }
  .vat-line { display: flex; justify-content: space-between; font-size: 11px; color: #6b7280; padding: 2px 10px; }
  .print-button { position: fixed; top: 12px; right: 12px; }
  @media print { .print-button { display: none; } }
</style>
</head>
<body>
  <div class="print-button">
    <button onclick="window.print()" style="background:${BRAND_RED};color:#fff;border:0;padding:8px 16px;border-radius:4px;font-weight:600;cursor:pointer;">🖨 Print</button>
  </div>
  <div class="wrap">
    <div class="head">
      <div class="org">
        <h1>${esc(organization.name || 'Alwaan')}</h1>
        ${organization.address ? `<p>${esc(organization.address)}</p>` : ''}
        ${organization.email ? `<p>${esc(organization.email)}</p>` : ''}
        ${organization.phone ? `<p>${esc(organization.phone)}</p>` : ''}
      </div>
      <div class="doc">
        <h2>Tax Invoice</h2>
        <div class="num">${esc(invoice.invoiceNo)}</div>
        <div class="date">Issued ${esc(fmtDate(invoice.createdAt))}</div>
        <div class="date">Payment Date ${esc(fmtDate(invoice.dueDate))}</div>
        ${invoice.status === 'Paid' ? '<div class="stamp">✓ Paid</div>' : ''}
      </div>
    </div>

    <div class="meta">
      <div class="box">
        <h3>Bill To (Tenant)</h3>
        <p class="name">${esc(tenant.name)}</p>
        ${tenant.email ? `<p>${esc(tenant.email)}</p>` : ''}
        ${tenant.phone ? `<p>${esc(tenant.phone)}</p>` : ''}
        ${tenant.emiratesId ? `<p>EID: ${esc(tenant.emiratesId)}</p>` : ''}
      </div>
      <div class="box">
        <h3>Property</h3>
        <p class="name">Unit ${esc(unit.unitNo)}${unit.unitType ? ` · ${esc(unit.unitType)}` : ''}</p>
        ${owner?.buildingName ? `<p>${esc(owner.buildingName)}</p>` : ''}
        ${owner?.address ? `<p>${esc(owner.address)}</p>` : ''}
        ${owner?.tradeLicense ? `<p>Trade Licence: ${esc(owner.tradeLicense)}</p>` : ''}
      </div>
    </div>

    <table class="items">
      <thead>
        <tr>
          <th>Description</th>
          <th class="r">Amount (AED)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${esc(invoice.type)}${invoice.notes && invoice.notes !== 'Auto-generated VAT invoice (' + invoice.type + ')' ? `<br/><small style="color:#6b7280;">${esc(invoice.notes)}</small>` : ''}</td>
          <td class="r">${esc(fmtAed(invoice.amount))}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr class="subtotal">
          <td>Subtotal (excl. VAT)</td>
          <td class="r">${esc(fmtAed(invoice.amount))}</td>
        </tr>
        <tr class="subtotal">
          <td>VAT (5%)</td>
          <td class="r">${esc(fmtAed(invoice.vatAmount))}</td>
        </tr>
        <tr class="total">
          <td>Total (incl. VAT)</td>
          <td class="r">${esc(fmtAed(invoice.totalAmount))}</td>
        </tr>
      </tfoot>
    </table>

    ${owner?.iban ? `<div style="border:1px solid #e5e7eb;border-radius:6px;padding:10px;margin-top:14px;font-size:11px;color:#555;"><strong>Bank Details:</strong> ${esc(owner.bankName || '—')} · IBAN ${esc(owner.iban)}</div>` : ''}

    <div class="footer">
      Alwaan PMS Tax Invoice · This is a computer-generated document and does not require a signature.
      <br />Generated ${esc(fmtDate(new Date()))}
    </div>
  </div>
</body>
</html>`
}
