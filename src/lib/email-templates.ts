/**
 * CRE (CRE) email templates.
 *
 * All templates return { subject, html } where `html` is a fully
 * self-contained, inline-styled email body. Email clients (Gmail,
 * Outlook) strip <style> tags inconsistently, so we rely exclusively
 * on inline styles.
 *
 * Brand palette:
 *   - Primary red: #E30613
 *   - Black:       #111111
 *   - Muted gray:  #6b7280
 *   - Card bg:     #ffffff
 *   - Page bg:     #f4f5f7
 */

const BRAND_RED = '#E30613'
const TEXT_DARK = '#111111'
const TEXT_MUTED = '#6b7280'
const BG = '#f4f5f7'
const CARD = '#ffffff'
const BORDER = '#e5e7eb'

interface OwnerLike {
  id: string
  ownerName: string
  email: string
  buildingName: string
  buildingType?: string
  emirate?: string
  area?: string
  totalUnits?: number
  contractTerm?: string
  managementFee?: number
  leasingCommissionRes?: number
  leasingCommissionCom?: number
}

interface ContractLike {
  id: string
  contractNo: string
  version: number
  status?: string
  serviceType?: string
  startDate?: string | Date | null
  endDate?: string | Date | null
  contractTerm?: string
  managementFee?: number
  leasingCommissionRes?: number
  leasingCommissionCom?: number
  signatureToken?: string | null
  reason?: string | null
}

interface DocumentLike {
  documentName?: string
  docType?: string
  expiryDate?: string | Date
}

function esc(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—'
  const dt = typeof d === 'string' ? new Date(d) : d
  if (isNaN(dt.getTime())) return String(d)
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function layout(opts: {
  baseUrl: string
  preheader: string
  heading: string
  bodyHtml: string
  ctaLabel?: string
  ctaHref?: string
}): string {
  const { baseUrl, preheader, heading, bodyHtml, ctaLabel, ctaHref } = opts
  const logoUrl = `${baseUrl.replace(/\/$/, '')}/cre-logo.png`

  const cta =
    ctaLabel && ctaHref
      ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0;">
           <tr><td align="center" style="border-radius:6px;background:${BRAND_RED};">
             <a href="${esc(ctaHref)}" target="_blank"
                style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:6px;letter-spacing:.3px;">
               ${esc(ctaLabel)}
             </a>
           </td></tr>
         </table>`
      : ''

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${esc(heading)}</title>
  </head>
  <body style="margin:0;padding:0;background:${BG};font-family:Arial,Helvetica,sans-serif;color:${TEXT_DARK};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${BG};padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;">
            <tr>
              <td align="center" style="padding:16px 0 24px 0;">
                <img src="${logoUrl}" alt="CRE" style="height:60px;display:block;margin:0 auto;border:0;outline:none;text-decoration:none;" />
              </td>
            </tr>
            <tr>
              <td style="background:${CARD};border:1px solid ${BORDER};border-radius:10px;padding:36px 36px 28px 36px;">
                <div style="height:4px;width:48px;background:${BRAND_RED};border-radius:2px;margin-bottom:20px;"></div>
                <h1 style="margin:0 0 16px 0;font-size:22px;line-height:1.3;color:${TEXT_DARK};font-weight:700;">
                  ${esc(heading)}
                </h1>
                <div style="font-size:14px;line-height:1.65;color:${TEXT_DARK};">
                  ${bodyHtml}
                </div>
                ${cta}
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:20px 12px 8px 12px;font-size:11px;line-height:1.5;color:${TEXT_MUTED};">
                <strong style="color:${TEXT_DARK};">CRE</strong> &middot; Dubai, UAE<br />
                This is an automated message &middot; Please do not reply directly to this email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function detailsTable(rows: Array<[string, string]>): string {
  const tr = rows
    .map(
      ([k, v]) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid ${BORDER};font-size:12px;color:${TEXT_MUTED};width:40%;">${esc(k)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid ${BORDER};font-size:13px;color:${TEXT_DARK};font-weight:600;">${esc(v)}</td>
        </tr>`
    )
    .join('')
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
            style="margin:18px 0;border:1px solid ${BORDER};border-radius:6px;border-collapse:separate;background:#fafafa;">
            ${tr}
          </table>`
}

/* ------------------------------------------------------------------ */
/* 1. Welcome Owner                                                   */
/* ------------------------------------------------------------------ */

export function welcomeOwnerTemplate(owner: OwnerLike, baseUrl: string) {
  const subject = `Welcome to CRE, ${owner.ownerName}`
  const details = detailsTable([
    ['Building', owner.buildingName || '—'],
    ['Type', owner.buildingType || '—'],
    ['Emirate', owner.emirate || '—'],
    ['Area', owner.area || '—'],
    ['Total Units', owner.totalUnits ? String(owner.totalUnits) : '—'],
  ])
  const bodyHtml = `
    <p style="margin:0 0 14px 0;">Dear ${esc(owner.ownerName)},</p>
    <p style="margin:0 0 14px 0;">
      Thank you for choosing <strong>CRE</strong> as your property management partner.
      We're delighted to welcome <strong>${esc(owner.buildingName)}</strong> to our portfolio.
    </p>
    <p style="margin:0 0 10px 0;font-weight:600;">Your Building on File</p>
    ${details}
    <p style="margin:18px 0 10px 0;font-weight:600;">What Happens Next</p>
    <ol style="margin:0 0 14px 18px;padding:0;color:${TEXT_DARK};">
      <li style="margin-bottom:6px;">Our team will prepare your Property Management Agreement proposal.</li>
      <li style="margin-bottom:6px;">You'll receive the agreement via email for review and signature.</li>
      <li style="margin-bottom:6px;">Once signed, we activate your building in our PMS and begin operations.</li>
    </ol>
    <p style="margin:14px 0 0 0;">
      If you have any questions, simply reply to this email or contact us at
      <a href="mailto:info@cre.ae" style="color:${BRAND_RED};text-decoration:none;">info@cre.ae</a>.
    </p>
  `
  return {
    subject,
    html: layout({
      baseUrl,
      preheader: `Welcome aboard — here's what to expect as we onboard ${owner.buildingName}.`,
      heading: `Welcome aboard, ${owner.ownerName}`,
      bodyHtml,
    }),
  }
}

/* ------------------------------------------------------------------ */
/* 2. Contract Generated                                              */
/* ------------------------------------------------------------------ */

export function contractGeneratedTemplate(owner: OwnerLike, contract: ContractLike, baseUrl: string) {
  const subject = `Your Property Management Agreement is Ready - ${contract.contractNo}`
  const token = contract.signatureToken ? `&token=${encodeURIComponent(contract.signatureToken)}` : ''
  const viewUrl = `${baseUrl.replace(/\/$/, '')}/api/owners/${owner.id}/contracts/${contract.id}?format=html${token}`

  const terms = detailsTable([
    ['Contract No', `${contract.contractNo} (v${contract.version})`],
    ['Building', owner.buildingName || '—'],
    ['Service Type', contract.serviceType || '—'],
    ['Term', contract.contractTerm || owner.contractTerm || '—'],
    ['Management Fee', contract.managementFee != null ? `${contract.managementFee}%` : '—'],
    ['Leasing Commission (Res)', contract.leasingCommissionRes != null ? `${contract.leasingCommissionRes}%` : '—'],
    ['Leasing Commission (Com)', contract.leasingCommissionCom != null ? `${contract.leasingCommissionCom}%` : '—'],
    ['Start Date', fmtDate(contract.startDate)],
    ['End Date', fmtDate(contract.endDate)],
  ])
  const bodyHtml = `
    <p style="margin:0 0 14px 0;">Dear ${esc(owner.ownerName)},</p>
    <p style="margin:0 0 14px 0;">
      Your Property Management Agreement <strong>v${esc(contract.version)}</strong> for
      <strong>${esc(owner.buildingName)}</strong> is ready for your review.
    </p>
    <p style="margin:18px 0 10px 0;font-weight:600;">Key Terms Summary</p>
    ${terms}
    <p style="margin:14px 0 0 0;">
      Please review the full agreement carefully by clicking the button below. A signature-ready PDF
      version will follow shortly.
    </p>
  `
  return {
    subject,
    html: layout({
      baseUrl,
      preheader: `Your PM Agreement ${contract.contractNo} v${contract.version} is ready for review.`,
      heading: 'Your Agreement Is Ready for Review',
      bodyHtml,
      ctaLabel: 'View Agreement',
      ctaHref: viewUrl,
    }),
  }
}

/* ------------------------------------------------------------------ */
/* 3. Contract Sent (signature request)                               */
/* ------------------------------------------------------------------ */

export function contractSentTemplate(owner: OwnerLike, contract: ContractLike, baseUrl: string) {
  const subject = `Action Required: Sign Property Management Agreement ${contract.contractNo}`
  const cleanBase = baseUrl.replace(/\/$/, '')
  const token = contract.signatureToken ? `&token=${encodeURIComponent(contract.signatureToken)}` : ''
  const viewUrl = `${cleanBase}/api/owners/${owner.id}/contracts/${contract.id}?format=html${token}`
  const signUrl = contract.signatureToken
    ? `${cleanBase}/sign/${encodeURIComponent(contract.signatureToken)}`
    : ''

  const signButton = signUrl ? `
    <div style="text-align:center;margin:22px 0;">
      <a href="${signUrl}"
         style="display:inline-block;background:${BRAND_RED};color:#fff;padding:14px 28px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:16px;">
         &#10003; Review &amp; Sign Online
      </a>
      <div style="margin-top:8px;color:${TEXT_MUTED};font-size:12px;">
        Secure online signing &middot; no printing required
      </div>
    </div>
  ` : ''

  const bodyHtml = `
    <p style="margin:0 0 14px 0;">Dear ${esc(owner.ownerName)},</p>
    <p style="margin:0 0 14px 0;">
      Please find your Property Management Agreement
      <strong>${esc(contract.contractNo)} (v${esc(contract.version)})</strong> for
      <strong>${esc(owner.buildingName)}</strong>. Your signature is required to activate the agreement.
    </p>
    <div style="background:#fff5f5;border-left:4px solid ${BRAND_RED};padding:14px 16px;margin:16px 0;border-radius:4px;">
      <strong style="color:${BRAND_RED};">Action Required:</strong>
      <span style="color:${TEXT_DARK};"> Please respond within 7 days.</span>
    </div>
    ${signButton}
    <p style="margin:10px 0 6px 0;font-weight:600;">How to Sign</p>
    <ol style="margin:0 0 14px 18px;padding:0;">
      <li style="margin-bottom:6px;">Click <strong>Review &amp; Sign Online</strong> above to open the secure signature page.</li>
      <li style="margin-bottom:6px;">Review the full bilingual agreement.</li>
      <li style="margin-bottom:6px;">Draw or type your signature and confirm.</li>
      <li style="margin-bottom:6px;">You will receive a confirmation email once CRE counter-signs.</li>
    </ol>
    <p style="margin:14px 0 0 0;color:${TEXT_MUTED};font-size:12px;">
      Contract No: ${esc(contract.contractNo)} &middot; Version ${esc(contract.version)}
      ${contract.serviceType ? ` &middot; ${esc(contract.serviceType)}` : ''}
    </p>
  `
  return {
    subject,
    html: layout({
      baseUrl,
      preheader: `Please sign and return PM Agreement ${contract.contractNo} within 7 days.`,
      heading: 'Signature Required',
      bodyHtml,
      ctaLabel: 'Open Agreement',
      ctaHref: viewUrl,
    }),
  }
}

/* ------------------------------------------------------------------ */
/* 4. Contract Signed                                                 */
/* ------------------------------------------------------------------ */

export function contractSignedTemplate(owner: OwnerLike, contract: ContractLike, baseUrl: string) {
  const subject = `Agreement Signed Successfully - ${contract.contractNo}`
  const token = contract.signatureToken ? `&token=${encodeURIComponent(contract.signatureToken)}` : ''
  const viewUrl = `${baseUrl.replace(/\/$/, '')}/api/owners/${owner.id}/contracts/${contract.id}?format=html${token}`

  const bodyHtml = `
    <p style="margin:0 0 14px 0;">Dear ${esc(owner.ownerName)},</p>
    <p style="margin:0 0 14px 0;">
      Great news — your Property Management Agreement
      <strong>${esc(contract.contractNo)} (v${esc(contract.version)})</strong> for
      <strong>${esc(owner.buildingName)}</strong> is now <strong style="color:#16a34a;">signed and active</strong>.
    </p>
    <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:14px 16px;margin:16px 0;border-radius:4px;color:${TEXT_DARK};">
      A countersigned copy is attached for your records.
    </div>
    <p style="margin:10px 0 6px 0;font-weight:600;">What's Next</p>
    <ol style="margin:0 0 14px 18px;padding:0;">
      <li style="margin-bottom:6px;">Your account is being set up in our Property Management System.</li>
      <li style="margin-bottom:6px;">Our operations team will reach out to collect unit and tenant data.</li>
      <li style="margin-bottom:6px;">You'll receive a go-live confirmation once your building is active in the PMS.</li>
    </ol>
    <p style="margin:14px 0 0 0;">
      Thank you for entrusting CRE with the management of your property.
    </p>
  `
  return {
    subject,
    html: layout({
      baseUrl,
      preheader: `Your PM Agreement ${contract.contractNo} is now signed and active.`,
      heading: 'Your Agreement Is Now Active',
      bodyHtml,
      ctaLabel: 'View Signed Agreement',
      ctaHref: viewUrl,
    }),
  }
}

/* ------------------------------------------------------------------ */
/* 5. Owner Activated (Live)                                          */
/* ------------------------------------------------------------------ */

export function ownerActivatedTemplate(owner: OwnerLike, baseUrl: string) {
  const subject = `You're Live with CRE!`
  const portalUrl = `${baseUrl.replace(/\/$/, '')}/owner-portal`
  const bodyHtml = `
    <p style="margin:0 0 14px 0;">Dear ${esc(owner.ownerName)},</p>
    <p style="margin:0 0 14px 0;">
      Congratulations — <strong>${esc(owner.buildingName)}</strong> is officially
      <strong style="color:#16a34a;">live</strong> in the CRE Property Management System.
    </p>
    <p style="margin:14px 0 10px 0;font-weight:600;">From Here Onwards</p>
    <ul style="margin:0 0 14px 18px;padding:0;">
      <li style="margin-bottom:6px;">You'll receive detailed monthly statements summarizing rental income, expenses, and management fees.</li>
      <li style="margin-bottom:6px;">Maintenance, leasing and tenant operations are being actively managed on your behalf.</li>
      <li style="margin-bottom:6px;">Major expenses above your approval threshold will be routed to you for sign-off.</li>
      <li style="margin-bottom:6px;">Access your owner portal for real-time visibility into your property's performance.</li>
    </ul>
    <p style="margin:14px 0 0 0;color:${TEXT_MUTED};font-size:12px;">
      Owner portal access is currently being provisioned and credentials will be emailed separately.
    </p>
  `
  return {
    subject,
    html: layout({
      baseUrl,
      preheader: `${owner.buildingName} is now live in the CRE PMS. Here's what to expect.`,
      heading: 'You Are Live in the CRE PMS',
      bodyHtml,
      ctaLabel: 'Open Owner Portal',
      ctaHref: portalUrl,
    }),
  }
}

/* ------------------------------------------------------------------ */
/* 6. Contract Amended                                                */
/* ------------------------------------------------------------------ */

export function contractAmendedTemplate(
  owner: OwnerLike,
  contract: ContractLike,
  oldContract: ContractLike,
  baseUrl: string
) {
  const subject = `Contract Amendment Notice - ${contract.contractNo}`
  const token = contract.signatureToken ? `&token=${encodeURIComponent(contract.signatureToken)}` : ''
  const newUrl = `${baseUrl.replace(/\/$/, '')}/api/owners/${owner.id}/contracts/${contract.id}?format=html${token}`
  const oldUrl = `${baseUrl.replace(/\/$/, '')}/api/owners/${owner.id}/contracts/${oldContract.id}?format=html`
  const reason = contract.reason || 'Contract updated'

  const diff = detailsTable([
    ['Previous Contract', `${oldContract.contractNo} (v${oldContract.version})`],
    ['New Contract', `${contract.contractNo} (v${contract.version})`],
    ['Reason', reason],
    ['Management Fee', contract.managementFee != null ? `${contract.managementFee}%` : '—'],
    ['Leasing (Res / Com)', `${contract.leasingCommissionRes ?? '—'}% / ${contract.leasingCommissionCom ?? '—'}%`],
    ['Term', contract.contractTerm || '—'],
  ])

  const bodyHtml = `
    <p style="margin:0 0 14px 0;">Dear ${esc(owner.ownerName)},</p>
    <p style="margin:0 0 14px 0;">
      Your Property Management Agreement for <strong>${esc(owner.buildingName)}</strong> has been amended.
      A new version has been issued and requires your review and signature.
    </p>
    <p style="margin:14px 0 6px 0;font-weight:600;">Amendment Summary</p>
    ${diff}
    <p style="margin:14px 0 8px 0;">You can compare the two versions here:</p>
    <p style="margin:0 0 14px 0;">
      <a href="${esc(oldUrl)}" style="color:${BRAND_RED};text-decoration:none;font-weight:600;">
        &rsaquo; View previous contract (${esc(oldContract.contractNo)} v${esc(oldContract.version)})
      </a>
    </p>
    <p style="margin:0 0 14px 0;">
      Please review the new agreement and return a signed copy at your earliest convenience.
    </p>
  `
  return {
    subject,
    html: layout({
      baseUrl,
      preheader: `Amendment: ${oldContract.contractNo} v${oldContract.version} → ${contract.contractNo} v${contract.version}`,
      heading: 'Contract Amendment Notice',
      bodyHtml,
      ctaLabel: 'Review New Agreement',
      ctaHref: newUrl,
    }),
  }
}

/* ------------------------------------------------------------------ */
/* 7. Document Expiring                                               */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Tenancy Contract emails                                            */
/* ------------------------------------------------------------------ */

interface TenantLike {
  id: string
  name: string
  email: string
}

interface TenancyContractLike {
  id: string
  contractNo: string
  version: number
  contractStart?: string
  contractEnd?: string
  rentAmount?: number
  numberOfCheques?: number
  contractType?: string
  signatureToken?: string
}

export function tenancyContractGeneratedTemplate(
  tenant: TenantLike,
  contract: TenancyContractLike,
  owner: OwnerLike | null,
  baseUrl: string
) {
  const subject = `Action Required: Sign Your Tenancy Contract - ${contract.contractNo}`
  const signUrl = contract.signatureToken
    ? `${baseUrl.replace(/\/$/, '')}/sign/${contract.signatureToken}`
    : `${baseUrl.replace(/\/$/, '')}/api/tenancy-contracts/${contract.id}?format=html`
  const terms = detailsTable([
    ['Contract No', `${contract.contractNo} (v${contract.version})`],
    ['Building', owner?.buildingName || '—'],
    ['Type', contract.contractType || '—'],
    ['Annual Rent', contract.rentAmount != null ? `AED ${contract.rentAmount.toLocaleString()}` : '—'],
    ['Cheques', String(contract.numberOfCheques ?? '—')],
    ['Start Date', fmtDate(contract.contractStart)],
    ['End Date', fmtDate(contract.contractEnd)],
  ])
  const bodyHtml = `
    <p style="margin:0 0 14px 0;">Dear ${esc(tenant.name)},</p>
    <p style="margin:0 0 14px 0;">
      Your Tenancy Contract <strong>v${esc(contract.version)}</strong> for
      <strong>${esc(owner?.buildingName || 'your unit')}</strong> is ready.
      Please review and sign online — no printing required.
    </p>
    <p style="margin:18px 0 10px 0;font-weight:600;">Key Terms</p>
    ${terms}
    <p style="margin:14px 0 0 0;">
      Click below to review the bilingual (English / Arabic) contract and
      sign it securely online.
    </p>
  `
  return {
    subject,
    html: layout({
      baseUrl,
      preheader: `Sign Tenancy Contract ${contract.contractNo} v${contract.version} online.`,
      heading: 'Review & Sign Your Contract',
      bodyHtml,
      ctaLabel: 'Review & Sign Online',
      ctaHref: signUrl,
    }),
  }
}

export function tenancyContractSentTemplate(
  tenant: TenantLike,
  contract: TenancyContractLike,
  owner: OwnerLike | null,
  baseUrl: string
) {
  const subject = `Action Required: Sign Tenancy Contract ${contract.contractNo}`
  const viewUrl = `${baseUrl.replace(/\/$/, '')}/api/tenancy-contracts/${contract.id}?format=html`
  const bodyHtml = `
    <p style="margin:0 0 14px 0;">Dear ${esc(tenant.name)},</p>
    <p style="margin:0 0 14px 0;">
      Please find your Tenancy Contract <strong>${esc(contract.contractNo)} (v${esc(contract.version)})</strong>
      for <strong>${esc(owner?.buildingName || 'your unit')}</strong>. Your signature is required to activate the lease.
    </p>
    <div style="background:#fff5f5;border-left:4px solid ${BRAND_RED};padding:14px 16px;margin:16px 0;border-radius:4px;">
      <strong style="color:${BRAND_RED};">Action Required:</strong>
      <span style="color:${TEXT_DARK};"> Please sign and return within 7 days.</span>
    </div>
    <ol style="margin:0 0 14px 18px;padding:0;">
      <li style="margin-bottom:6px;">Click the button below to open the contract.</li>
      <li style="margin-bottom:6px;">Print, sign in the Tenant signature block, and scan.</li>
      <li style="margin-bottom:6px;">Email the signed copy back to
        <a href="mailto:info@cre.ae" style="color:${BRAND_RED};text-decoration:none;">info@cre.ae</a>.</li>
    </ol>
  `
  return {
    subject,
    html: layout({
      baseUrl,
      preheader: `Please sign and return Tenancy Contract ${contract.contractNo}.`,
      heading: 'Signature Required',
      bodyHtml,
      ctaLabel: 'Open Contract',
      ctaHref: viewUrl,
    }),
  }
}

export function tenancyContractSignedTemplate(
  tenant: TenantLike,
  contract: TenancyContractLike,
  owner: OwnerLike | null,
  baseUrl: string
) {
  const subject = `Tenancy Contract Signed - ${contract.contractNo}`
  const viewUrl = `${baseUrl.replace(/\/$/, '')}/api/tenancy-contracts/${contract.id}?format=html`
  const bodyHtml = `
    <p style="margin:0 0 14px 0;">Dear ${esc(tenant.name)},</p>
    <p style="margin:0 0 14px 0;">
      Your Tenancy Contract <strong>${esc(contract.contractNo)} (v${esc(contract.version)})</strong>
      for <strong>${esc(owner?.buildingName || 'your unit')}</strong> is now
      <strong style="color:#16a34a;">signed and active</strong>.
    </p>
    <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:14px 16px;margin:16px 0;border-radius:4px;color:${TEXT_DARK};">
      Welcome to your new home. A countersigned copy is on file for your records.
    </div>
    <p style="margin:14px 0 0 0;">
      Thank you for choosing CRE.
    </p>
  `
  return {
    subject,
    html: layout({
      baseUrl,
      preheader: `Tenancy Contract ${contract.contractNo} is now active.`,
      heading: 'Your Tenancy Is Active',
      bodyHtml,
      ctaLabel: 'View Signed Contract',
      ctaHref: viewUrl,
    }),
  }
}

export function documentExpiringTemplate(
  owner: OwnerLike,
  doc: DocumentLike,
  daysLeft: number,
  baseUrl: string
) {
  const docType = doc.docType || doc.documentName || 'Document'
  const subject = `Reminder: ${docType} Expiring in ${daysLeft} days`

  const details = detailsTable([
    ['Document', doc.documentName || docType],
    ['Type', docType],
    ['Expiry Date', fmtDate(doc.expiryDate)],
    ['Days Remaining', String(daysLeft)],
    ['Building', owner.buildingName || '—'],
  ])

  const urgencyColor = daysLeft <= 7 ? BRAND_RED : daysLeft <= 30 ? '#d97706' : TEXT_MUTED
  const bodyHtml = `
    <p style="margin:0 0 14px 0;">Dear ${esc(owner.ownerName)},</p>
    <p style="margin:0 0 14px 0;">
      This is a friendly reminder that the following document on record for
      <strong>${esc(owner.buildingName)}</strong> is approaching its expiry date and will require renewal.
    </p>
    ${details}
    <div style="background:#fff8ed;border-left:4px solid ${urgencyColor};padding:14px 16px;margin:16px 0;border-radius:4px;color:${TEXT_DARK};">
      <strong style="color:${urgencyColor};">${esc(daysLeft)} day${daysLeft === 1 ? '' : 's'} remaining.</strong>
      Please arrange for renewal as soon as possible to avoid any service interruptions.
    </div>
    <p style="margin:14px 0 0 0;">
      If you have already initiated the renewal or need our assistance, simply reply to this email
      and our team will take it from there.
    </p>
  `
  return {
    subject,
    html: layout({
      baseUrl,
      preheader: `${docType} expires in ${daysLeft} days — renewal required.`,
      heading: `${docType} Renewal Reminder`,
      bodyHtml,
    }),
  }
}
