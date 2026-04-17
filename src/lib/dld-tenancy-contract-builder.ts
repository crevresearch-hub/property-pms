/**
 * DLD-style Tenancy Contract HTML builder (CRE-branded edition).
 *
 * Replicates the official Dubai Land Department (DLD) bilingual
 * Unified Tenancy Contract layout used by CRE,
 * restyled with CRE red/black/white branding.
 *
 *   - Government of Dubai + DLD logos header (served from /public)
 *   - Owner / Lessor / Tenant / Property / Contract tables
 *   - Bilingual EN/AR terms & conditions (side-by-side)
 *   - Know-Your-Rights, Ejari attachments, 5 CRE addendum points
 *   - Signature blocks for Tenant + Lessor
 *   - CRE footer logo + DLD official footer
 *
 * Output is a fully self-contained HTML document (A4, print-ready)
 * safe to store in TenancyContract.htmlBody.
 */

export type DldTenantInput = {
  name: string
  email: string
  phone: string
  emiratesId: string
  occupants?: number
  isCompany?: boolean
  companyName?: string
  companyTradeLicense?: string
}

export type DldUnitInput = {
  unitNo: string
  unitType: string
  currentRent: number
  contractStart: string
  contractEnd: string
}

export type DldOwnerInput = {
  ownerName: string
  buildingName: string
  area: string
  plotNo: string
  makaniNo: string
  dewaPremiseNo?: string
}

export type BuildDldTenancyContractInput = {
  tenant: DldTenantInput
  unit: DldUnitInput
  owner: DldOwnerInput
  contractValue: number
  securityDeposit: number
  numCheques: number
  date: string
  /** Omit sections 1 (Owner/Lessor) and 2 (Tenant) — used for the initial
      pre-signing copy where tenant identity is not yet known. */
  omitParties?: boolean
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function fmtMoney(n: number): string {
  const v = Number.isFinite(n) ? n : 0
  return `AED ${v.toLocaleString('en-AE', { maximumFractionDigits: 2 })}`
}

function fmtDate(d: string): string {
  if (!d) return '—'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return d
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function inferPropertyType(unitType: string): string {
  if (!unitType) return '—'
  return unitType
}

/* ------------------------------------------------------------------ */
/*  Main builder                                                       */
/* ------------------------------------------------------------------ */

export function buildDldTenancyContractHTML(
  data: BuildDldTenancyContractInput,
  baseUrl: string = ''
): string {
  const { tenant, unit, owner, contractValue, securityDeposit, numCheques, date, omitParties } = data

  // User-provided official logos
  const govLogoSrc = `${baseUrl}/dubai-gov-logo.jpeg`
  const dldLogoSrc = `${baseUrl}/dld-logo.png`
  const creLogoSrc = ""

  const annualRent = unit.currentRent
  const propertyType = inferPropertyType(unit.unitType)
  const usage: string = 'Residential'
  const tenantDisplayName = tenant.isCompany && tenant.companyName ? tenant.companyName : tenant.name
  const tenantLicenseNo = tenant.isCompany ? (tenant.companyTradeLicense || '—') : '—'
  const tenantLicAuth = tenant.isCompany ? 'DED' : '—'
  const occupants = tenant.occupants ?? 0

  const termsBilingual: Array<{ en: string; ar: string }> = [
    {
      en: 'The tenant has inspected the premises and agreed to lease the unit on its current condition.',
      ar: 'قام المستأجر بمعاينة المأجور ويرغب باستئجار الوحدة بحالتها الراهنة.',
    },
    {
      en: 'Tenant undertakes to use the premises for designated purpose. Tenant has no right to transfer, assign or relinquish the tenancy contract to any third party or to sublease the premises without prior written consent from the landlord.',
      ar: 'يلتزم المستأجر باستخدام المأجور للغرض المخصص له وليس له الحق في التنازل عن عقد الإيجار أو التأجير من الباطن إلا بموافقة خطية مسبقة من المالك.',
    },
    {
      en: 'The tenant undertakes not to make any amendments or alterations in the premises without written consent from the landlord and the competent authorities.',
      ar: 'يلتزم المستأجر بعدم إجراء أي تعديلات في المأجور إلا بموافقة خطية من المالك والجهات المختصة.',
    },
    {
      en: 'The tenant shall be responsible for payment of all electricity, water, cooling and gas charges (DEWA / Empower / etc.) throughout the contract period.',
      ar: 'يتحمل المستأجر رسوم الكهرباء والمياه والتبريد والغاز خلال فترة العقد.',
    },
    {
      en: 'The tenant must pay the rent amount in the manner and dates agreed with the landlord.',
      ar: 'يلتزم المستأجر بسداد بدل الإيجار بالطريقة والمواعيد المتفق عليها مع المالك.',
    },
    {
      en: 'The tenant fully undertakes to comply with all the regulations and instructions issued by the competent authorities and building management.',
      ar: 'يلتزم المستأجر الالتزام التام بجميع القوانين والتعليمات الصادرة عن الجهات المختصة وإدارة المبنى.',
    },
    {
      en: 'Tenancy contract parties declare all mentioned emails addresses and phone numbers are correct and any legal notice sent to them shall be considered valid notification.',
      ar: 'يقر طرفا عقد الإيجار بأن جميع عناوين البريد الإلكتروني وأرقام الهواتف المذكورة صحيحة وأي إشعار قانوني يرسل عليها يعتبر إشعاراً صحيحاً.',
    },
    {
      en: 'The landlord undertakes to enable the tenant of the full use of the premises including its facilities throughout the contract period.',
      ar: 'يلتزم المالك بتمكين المستأجر من الانتفاع الكامل بالمأجور ومرافقه طوال مدة العقد.',
    },
    {
      en: 'By signing this agreement from the first party, the "Landlord" hereby confirms and undertakes that he is the current owner of the leased property and has full legal right to lease it.',
      ar: 'يقر ويتعهد المالك (الطرف الأول) بتوقيعه على هذا العقد بأنه المالك الحالي للعقار المؤجر وله كامل الحق القانوني في تأجيره.',
    },
    {
      en: 'Any disagreement or dispute that may arise from execution or interpretation of this contract shall be settled by the Rental Dispute Center.',
      ar: 'أي نزاع ينشأ عن تنفيذ أو تفسير هذا العقد يحال إلى مركز فض المنازعات الإيجارية.',
    },
    {
      en: 'This contract is subject to all provisions of Law No (26) of 2007 and its amendments regulating the relationship between Landlords and Tenants in the Emirate of Dubai.',
      ar: 'يخضع هذا العقد لأحكام القانون رقم (26) لسنة 2007 وتعديلاته المنظم للعلاقة بين المؤجرين والمستأجرين في إمارة دبي.',
    },
    {
      en: 'Any additional condition will not be considered in case it conflicts with law.',
      ar: 'لا يعتد بأي شرط إضافي في حال تعارضه مع القانون.',
    },
    {
      en: 'In case of discrepancy occurs between Arabic and non Arabic texts, the Arabic text shall prevail.',
      ar: 'في حال وجود تعارض بين النصين العربي وغير العربي، يعتمد النص العربي.',
    },
    {
      en: 'The landlord undertakes to register this tenancy contract on EJARI system before handing over the premises to the tenant.',
      ar: 'يتعهد المالك بتسجيل عقد الإيجار في نظام إيجاري قبل تسليم المأجور للمستأجر.',
    },
  ]

  const termsHtml = termsBilingual
    .map(
      (t, i) => `
      <tr class="terms-row">
        <td class="term-num">${i + 1}</td>
        <td class="term-en">${esc(t.en)}</td>
        <td class="term-ar" dir="rtl">${esc(t.ar)}</td>
      </tr>`
    )
    .join('')

  const additionalTerms: string[] = [
    'Maintenance and chiller are included in the rent. The terms outlined in the tenancy contract and Ejari forms are an integral part of this lease agreement.',
    `Only the tenant holding Emirates ID No (${esc(tenant.emiratesId || '—')}) and dependents (Wife/Husband & Children) have the right to occupy the apartment. Any additional occupant must be declared and approved in writing by the landlord.`,
    'Annual administrative fees AED 2,100 (VAT Inclusive) for residential leases, AED 2,100 (VAT Inclusive) for commercial leases, and AED 250 for Ejari registration are payable by the tenant at the time of contract signing.',
    'In case of delay in renewing the contract for a period of 15 days, a fine of AED 525/- (VAT Inclusive) applies. Beyond 30 days, a fine of AED 1,050 (VAT Inclusive) applies, after which the file will be transferred to the Legal Department for further action.',
    'Bounced cheque fees AED 1,050/- (VAT Inclusive). Cheque replacement fees AED 262.50. Cheque postponement fees AED 262.50. The fees of name changing or lease transfer to another unit is 5% of annual rent for residential units (+VAT) and 10% of annual rent for commercial units (+VAT).',
  ]

  const additionalHtml = additionalTerms
    .map((t, i) => `<li><span class="add-num">${i + 1}.</span> ${t}</li>`)
    .join('')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Tenancy Contract · ${esc(unit.unitNo)}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    background: #f4f4f4;
    font-family: 'Times New Roman', Times, serif;
    color: #000;
    font-size: 11.5px;
    line-height: 1.45;
  }
  .sheet {
    background: #fff;
    width: 210mm;
    min-height: 297mm;
    margin: 14px auto;
    padding: 16mm 14mm 18mm 14mm;
    box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  }
  .ar { font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; }

  /* Header — plain, simple, balanced */
  .doc-header {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    align-items: center;
    padding: 8px 0;
    margin-bottom: 14px;
    border-bottom: 1px solid #000;
    gap: 8px;
  }
  .doc-header .logo-left,
  .doc-header .logo-right {
    display: flex;
    align-items: center;
    height: 90px;
  }
  .doc-header .logo-left { justify-content: flex-start; }
  .doc-header .logo-right { justify-content: flex-end; }
  .doc-header .logo-left img,
  .doc-header .logo-right img {
    max-height: 90px;
    max-width: 100%;
    width: auto;
    display: block;
    object-fit: contain;
  }
  .doc-header .title-block {
    text-align: center;
    padding: 0 4px;
  }
  .doc-header .title-en {
    font-size: 14px;
    font-weight: 700;
    color: #000;
    line-height: 1.3;
  }
  .doc-header .title-ar {
    font-size: 14px;
    font-weight: 700;
    color: #000;
    margin-top: 2px;
    line-height: 1.3;
  }
  .doc-header .date-line {
    font-size: 10.5px;
    color: #000;
    margin-top: 6px;
  }

  /* Sections — simple bilingual header bar */
  h2.section-title {
    background: #f2f2f2;
    color: #000;
    font-size: 12px;
    margin: 16px 0 0 0;
    padding: 8px 12px;
    letter-spacing: 0.3px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-left: 4px solid #E30613;
    text-transform: uppercase;
    font-weight: 700;
  }
  h2.section-title .ar { font-size: 13px; font-weight: 700; text-transform: none; }

  table.info {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 4px;
    border: 1px solid #000;
    border-top: none;
  }
  table.info th, table.info td {
    border: 1px solid #c7c7c7;
    padding: 6px 8px;
    vertical-align: top;
    font-size: 11px;
  }
  table.info th {
    width: 26%;
    background: #f5f5f5;
    text-align: left;
    font-weight: 600;
    color: #000;
  }
  table.info td { background: #fff; color: #000; }
  table.info .half th { width: 22%; }

  /* Terms */
  table.terms {
    width: 100%;
    border-collapse: collapse;
    margin-top: 2px;
    border: 1px solid #000;
    border-top: none;
  }
  table.terms th, table.terms td {
    border: 1px solid #c7c7c7;
    padding: 6px 8px;
    vertical-align: top;
    font-size: 10.5px;
    color: #000;
  }
  table.terms thead th {
    background: #f5f5f5;
    color: #000;
    font-weight: 700;
  }
  .term-num { width: 4%; text-align: center; color: #E30613; font-weight: 700; }
  .term-en { width: 48%; }
  .term-ar { width: 48%; text-align: right; font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; }

  /* Signature blocks */
  .signatures {
    display: flex;
    gap: 16px;
    margin-top: 16px;
  }
  .sig-box {
    flex: 1;
    border: 1px solid #000;
    padding: 10px 12px;
    background: #fff;
  }
  .sig-box .label {
    font-size: 11px;
    font-weight: 700;
    color: #E30613;
    margin-bottom: 42px;
    border-bottom: 1px dashed #ddd;
    padding-bottom: 4px;
  }
  .sig-box .line {
    border-top: 2px solid #E30613;
    padding-top: 4px;
    font-size: 10.5px;
    color: #000;
    display: flex;
    justify-content: space-between;
  }

  /* Know your rights */
  .rights {
    border: 1px solid #000;
    border-top: none;
    padding: 8px 12px;
    background: #fff;
    font-size: 10.5px;
    color: #000;
  }
  .rights ul { margin: 4px 0 4px 18px; padding: 0; }
  .rights li { margin: 2px 0; }
  .rights a { color: #E30613; text-decoration: none; }

  /* Additional terms */
  ol.additional {
    margin: 6px 0 0 0;
    padding: 8px 14px;
    border: 1px solid #000;
    border-top: none;
    background: #fff;
  }
  ol.additional > li { margin: 6px 0; font-size: 10.5px; list-style: none; color: #000; }
  .add-num { font-weight: 700; color: #E30613; margin-right: 4px; }

  /* CRE footer brand */
  .cre-brand-footer {
    margin-top: 22px;
    padding: 12px 0 8px 0;
    border-top: 2px solid #E30613;
    text-align: center;
  }
  .cre-brand-footer img {
    height: 34px;
    width: auto;
    display: inline-block;
  }
  .cre-brand-footer .tag {
    display: block;
    margin-top: 6px;
    font-size: 10px;
    color: #000;
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }

  /* Footer */
  .doc-footer {
    margin-top: 6px;
    padding-top: 8px;
    border-top: 1px solid #000;
    text-align: center;
    font-size: 9.5px;
    color: #000;
  }
  .doc-footer a { color: #E30613; text-decoration: none; }

  @media print {
    body { background: #fff; }
    .sheet { box-shadow: none; margin: 0; }
  }
</style>
</head>
<body>
<div class="sheet">

  <!-- ============ HEADER ============ -->
  <div class="doc-header">
    <div class="logo-left"><img src="${esc(govLogoSrc)}" alt="Government of Dubai"/></div>
    <div class="title-block">
      <div class="title-en">Tenancy Contract</div>
      <div class="title-ar ar">عقد إيجار</div>
      <div class="date-line">Date: <strong>${esc(fmtDate(date))}</strong></div>
    </div>
    <div class="logo-right"><img src="${esc(dldLogoSrc)}" alt="Dubai Land Department"/></div>
  </div>

  ${omitParties ? `
  <!-- Parties info omitted for pre-signing copy.
       Will be added automatically once tenant uploads EID + signs. -->
  <div style="margin:14px 0;padding:14px 18px;border:1px dashed #E30613;border-radius:6px;background:#fffafa;color:#7a0a12;font-size:11px;">
    <strong>Parties information will be added automatically</strong> once you upload your Emirates ID and submit your electronic signature.
  </div>
  ` : `
  <!-- ============ SECTION 1: OWNER / LESSOR ============ -->
  <h2 class="section-title"><span>1. Owner / Lessor Information</span><span class="ar">معلومات المالك والمؤجر</span></h2>
  <table class="info">
    <tr><th>Owner's Name</th><td>${esc(owner.ownerName || '—')}</td>
        <th>Lessor's Name</th><td>CRE L.L.C.</td></tr>
    <tr><th>Lessor's Emirates ID</th><td>784-XXXX-XXXXXXX-X</td>
        <th>License No.</th><td>DED-591234</td></tr>
    <tr><th>Licensing Authority</th><td>DED (Department of Economic Development)</td>
        <th>Lessor's Email</th><td>info@cre.ae</td></tr>
    <tr><th>Lessor's Phone</th><td>+971 4 000 0000</td>
        <th>Licensing Jurisdiction</th><td>Emirate of Dubai</td></tr>
  </table>

  <!-- ============ SECTION 2: TENANT ============ -->
  <h2 class="section-title"><span>2. Tenant Information</span><span class="ar">معلومات المستأجر</span></h2>
  <table class="info">
    <tr><th>Tenant's Name</th><td>${esc(tenantDisplayName)}</td>
        <th>Tenant's Emirates ID</th><td>${esc(tenant.emiratesId || '—')}</td></tr>
    <tr><th>License No.</th><td>${esc(tenantLicenseNo)}</td>
        <th>Licensing Authority</th><td>${esc(tenantLicAuth)}</td></tr>
    <tr><th>Tenant's Email</th><td>${esc(tenant.email || '—')}</td>
        <th>Tenant's Phone</th><td>${esc(tenant.phone || '—')}</td></tr>
    <tr><th>Number of Co-Occupants</th><td colspan="3">${esc(occupants)}</td></tr>
  </table>
  `}

  <!-- ============ SECTION 3: PROPERTY ============ -->
  <h2 class="section-title"><span>3. Property Information</span><span class="ar">معلومات العقار</span></h2>
  <table class="info">
    <tr><th>Property Usage</th>
        <td>
          <label style="margin-right:10px;"><input type="checkbox" ${usage === 'Industrial' ? 'checked' : ''} disabled/> Industrial</label>
          <label style="margin-right:10px;"><input type="checkbox" ${usage === 'Commercial' ? 'checked' : ''} disabled/> Commercial</label>
          <label><input type="checkbox" ${usage === 'Residential' ? 'checked' : ''} disabled/> Residential</label>
        </td>
        <th>Plot No. / Makani No.</th>
        <td>${esc(owner.plotNo || '—')} / ${esc(owner.makaniNo || '—')}</td></tr>
    <tr><th>Building Name / Property No.</th><td>${esc(owner.buildingName || '—')} / Unit-${esc(unit.unitNo)}</td>
        <th>Property Type</th><td>${esc(propertyType)}</td></tr>
    <tr><th>Property Area (sqm)</th><td>—</td>
        <th>Location</th><td>${esc(owner.area || '—')}</td></tr>
    <tr><th>Premises No. (DEWA)</th><td colspan="3">${esc(owner.dewaPremiseNo || '—')}</td></tr>
  </table>

  <!-- ============ SECTION 4: CONTRACT ============ -->
  <h2 class="section-title"><span>4. Contract Information</span><span class="ar">معلومات العقد</span></h2>
  <table class="info">
    <tr><th>Contract Period — From</th><td>${esc(fmtDate(unit.contractStart))}</td>
        <th>Contract Period — To</th><td>${esc(fmtDate(unit.contractEnd))}</td></tr>
    <tr><th>Contract Value</th><td>${esc(fmtMoney(contractValue))}</td>
        <th>Annual Rent</th><td>${esc(fmtMoney(annualRent))}</td></tr>
    <tr><th>Security Deposit</th><td>${esc(fmtMoney(securityDeposit))}</td>
        <th>Mode of Payment</th><td>${esc(numCheques)} Installments (In Cheques)</td></tr>
  </table>

  <!-- ============ SECTION 5: TERMS ============ -->
  <h2 class="section-title"><span>5. Terms and Conditions</span><span class="ar">الأحكام والشروط</span></h2>
  <table class="terms">
    <thead>
      <tr><th>#</th><th>English</th><th class="ar" dir="rtl">العربية</th></tr>
    </thead>
    <tbody>${termsHtml}</tbody>
  </table>

  <!-- ============ SECTION 6: SIGNATURES ============ -->
  <h2 class="section-title"><span>6. Signatures</span><span class="ar">التواقيع</span></h2>
  <div class="signatures">
    <div class="sig-box">
      <div class="label">Tenant Signature / توقيع المستأجر</div>
      <div class="line"><span>Name: ${esc(tenantDisplayName)}</span><span>Date: ____________</span></div>
    </div>
    <div class="sig-box">
      <div class="label">Lessor's Signature / توقيع المؤجر</div>
      <div class="line"><span>CRE L.L.C.</span><span>Date: ____________</span></div>
    </div>
  </div>

  <!-- ============ SECTION 7: KNOW YOUR RIGHTS ============ -->
  <h2 class="section-title"><span>7. Know Your Rights</span><span class="ar">اعرف حقوقك</span></h2>
  <div class="rights">
    <ul>
      <li>Visit the Rental Dispute Center website: <a href="https://www.dubailand.gov.ae" target="_blank" rel="noopener">www.dubailand.gov.ae</a></li>
      <li>Law No. (26) of 2007 — regulating the relationship between Landlords and Tenants in the Emirate of Dubai.</li>
      <li>Law No. (33) of 2008 — amending Law No. (26) of 2007.</li>
      <li>Decree No. (43) of 2013 — determining rent increases for real property in Dubai.</li>
    </ul>
  </div>

  <!-- ============ SECTION 8: EJARI ATTACHMENTS ============ -->
  <h2 class="section-title"><span>8. Attachments for Ejari Registration</span><span class="ar">مرفقات تسجيل إيجاري</span></h2>
  <div class="rights">
    <ol style="margin:4px 0 4px 18px;padding:0;">
      <li>Original unified tenancy contract.</li>
      <li>Original Emirates ID of applicant.</li>
    </ol>
  </div>

  <!-- ============ SECTION 9: ADDITIONAL TERMS ============ -->
  <h2 class="section-title"><span>9. Additional Terms (CRE Addendum)</span><span class="ar">شروط إضافية</span></h2>
  <ol class="additional">
    ${additionalHtml}
  </ol>

  <!-- ============ FINAL SIGNATURES ============ -->
  <div class="signatures" style="margin-top:18px;">
    <div class="sig-box">
      <div class="label">Tenant Signature / توقيع المستأجر</div>
      <div class="line"><span>${esc(tenantDisplayName)}</span><span>Date: ____________</span></div>
    </div>
    <div class="sig-box">
      <div class="label">Lessor's Signature / توقيع المؤجر</div>
      <div class="line"><span>CRE L.L.C.</span><span>Date: ____________</span></div>
    </div>
  </div>

  <!-- ============ CRE BRAND FOOTER ============ -->
  <div class="cre-brand-footer">
    <img src="${esc(creLogoSrc)}" alt="CRE"/>
    <span class="tag">Managed by CRE · Dubai, U.A.E.</span>
  </div>

  <!-- ============ DLD OFFICIAL FOOTER ============ -->
  <div class="doc-footer">
    Tel: 8004488 &nbsp;·&nbsp; Fax: +971 4 222 2251 &nbsp;·&nbsp; P.O. Box 1166, Dubai, U.A.E.
    &nbsp;·&nbsp; E-mail: <a href="mailto:support@dubailand.gov.ae">support@dubailand.gov.ae</a>
    &nbsp;·&nbsp; Website: <a href="https://www.dubailand.gov.ae">www.dubailand.gov.ae</a>
  </div>

</div>
</body>
</html>`
}

export default buildDldTenancyContractHTML
