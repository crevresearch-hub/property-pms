import { formatDate } from '@/lib/utils'
import { getDefaultContractContent, type ContractContent } from '@/lib/contract-clauses-default'

export type PropertyOwnerRecord = {
  id: string
  ownerName: string
  ownerType: string
  emiratesId: string
  passportNo: string
  nationality: string
  email: string
  phone: string
  alternatePhone: string
  address: string
  iban: string
  bankName: string
  tradeLicense: string
  buildingName: string
  buildingType: string
  emirate: string
  area: string
  plotNo: string
  makaniNo: string
  titleDeedNo: string
  totalUnits: number
  totalFloors: number
  parkingSpaces: number
  yearBuilt: string
  buildingDescription: string
  serviceType: string
  servicesIncluded: string
  leasingCommissionRes: number
  leasingCommissionCom: number
  managementFee: number
  renewalFeeRes: number
  renewalFeeCom: number
  maintenanceMarkup: number
  customCommissionNotes: string
  contractStartDate: string
  contractEndDate: string
  contractTerm: string
  noticePeriodDays: number
  autoRenew: boolean
  exclusiveMandate: boolean
  paymentFrequency: string
  reportingFrequency: string
  approvalThreshold: number
  signatureToken: string
  // Optional signature data (attached when rendering a signed contract)
  ownerSignatureImage?: string
  creSignatureImage?: string
  ownerSignedAt?: string | Date | null
  creSignedAt?: string | Date | null
  ownerIpAddress?: string
  signedByOwnerName?: string
  signedByCREName?: string
}

function fmtSigDate(d: string | Date | null | undefined): string {
  if (!d) return ''
  const dt = typeof d === 'string' ? new Date(d) : d
  if (isNaN(dt.getTime())) return String(d)
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

// Helper: render a bilingual row (English left, Arabic right)
function bi(en: string, ar: string): string {
  return `<div class="bi-row">
    <div class="bi-en">${en}</div>
    <div class="bi-ar" dir="rtl">${ar}</div>
  </div>`
}

// Helper: render a bilingual section heading
function biH(num: string, en: string, ar: string): string {
  return `<h2 class="section-h">
    <span class="sec-num">${num}</span>
    <span class="sec-en">${en}</span>
    <span class="sec-ar" dir="rtl">${ar}</span>
  </h2>`
}

// Helper: bilingual numbered list item (simple layout)
function biLi(n: number, en: string, ar: string): string {
  return `<div class="bi-li">
    <div style="display:flex;gap:18px;align-items:flex-start">
      <div class="bi-li-num">${n}.</div>
      <div class="bi-li-en">${en}</div>
      <div class="bi-li-ar" dir="rtl">${ar}</div>
    </div>
  </div>`
}

export function buildContractHTML(
  o: PropertyOwnerRecord,
  orgName: string,
  baseUrl: string,
  primaryImagePath?: string,
  content?: ContractContent
): string {
  const today = formatDate(new Date().toISOString())
  const refNo = `PMA-${o.id.slice(-8).toUpperCase()}`
  const isCommercial = o.buildingType === 'Commercial'
  const tenantSafe = (s: string) => (s || '—').toString()

  // Use provided content or fall back to default
  const C = content || getDefaultContractContent()

  // Token replacement for dynamic values inside editable clauses
  const tpl = (s: string): string =>
    s
      .replace(/\{\{noticePeriodDays\}\}/g, String(o.noticePeriodDays))
      .replace(/\{\{approvalThreshold\}\}/g, o.approvalThreshold.toLocaleString())
      .replace(/\{\{paymentFrequency\}\}/g, o.paymentFrequency)
      .replace(/\{\{paymentFrequencyDesc\}\}/g, o.paymentFrequency === 'Monthly' ? 'every calendar month' : 'every quarter')
      .replace(/\{\{paymentFrequencyArDesc\}\}/g, o.paymentFrequency === 'Monthly' ? 'شهرياً (كل شهر ميلادي)' : 'ربع سنوي (كل ثلاثة أشهر)')

  // Service list — English + Arabic pairs (from editable content)
  const services: { en: string; ar: string }[] = C.services.length ? C.services : [
    { en: 'Marketing & Leasing of vacant units', ar: 'تسويق وتأجير الوحدات الشاغرة' },
    { en: 'Tenant screening & background verification', ar: 'فحص المستأجرين والتحقق من خلفياتهم' },
    { en: 'EJARI / Tenancy Contract Registration', ar: 'تسجيل عقد الإيجار / إيجاري' },
    { en: 'Rent collection (cheques, bank transfers, cash)', ar: 'تحصيل الإيجارات (الشيكات، التحويلات المصرفية، النقد)' },
    { en: 'Post-Dated Cheques (PDC) management & deposits', ar: 'إدارة الشيكات الآجلة وإيداعها' },
    { en: 'Maintenance coordination (24/7 emergency response)', ar: 'تنسيق الصيانة (استجابة طارئة 24/7)' },
    { en: 'Vendor management & quality control', ar: 'إدارة الموردين ومراقبة الجودة' },
    { en: 'DEWA / SEWA / FEWA utility setup & disconnection', ar: 'تفعيل وفصل خدمات هيئة الكهرباء والمياه' },
    { en: 'Move-in & Move-out inspections (with reports)', ar: 'فحوصات الدخول والإخلاء (مع التقارير)' },
    { en: 'Lease renewals & rent negotiation', ar: 'تجديد عقود الإيجار والتفاوض على القيم الإيجارية' },
    { en: 'Legal escalation (RDC, Police, Courts)', ar: 'التصعيد القانوني (مركز فض المنازعات، الشرطة، المحاكم)' },
    { en: 'Monthly financial statements to Owner', ar: 'كشوف مالية شهرية للمالك' },
    { en: 'Quarterly market benchmarking reports', ar: 'تقارير دراسة السوق ربع سنوية' },
    { en: 'Annual property condition report', ar: 'تقرير حالة العقار السنوي' },
    { en: 'Customer satisfaction surveys', ar: 'استبيانات رضا العملاء' },
  ]

  // Service rows for table
  const serviceRows = services.map((s, i) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td class="en">${s.en}</td>
      <td class="ar" dir="rtl">${s.ar}</td>
      <td class="check">${'\u2713'}</td>
    </tr>`).join('')

  // Fees structure (from editable content, mapped to internal shape)
  const fees: { service: { en: string; ar: string }; amount: string; remarks: { en: string; ar: string }; beneficiary: string }[] = C.fees.length
    ? C.fees.map(f => ({
        service: { en: f.serviceEn, ar: f.serviceAr },
        amount: f.amount,
        remarks: { en: f.remarksEn, ar: f.remarksAr },
        beneficiary: f.beneficiary,
      }))
    : [
    {
      service: { en: 'New Lease Commission (Residential)', ar: 'عمولة عقد إيجار جديد (سكني)' },
      amount: '5% of annual rent (or AED 1,050 min, VAT inclusive)',
      remarks: { en: 'For each new lease concluded', ar: 'لكل عقد إيجار جديد يتم إبرامه' },
      beneficiary: 'Alwaan',
    },
    {
      service: { en: 'New Lease Commission (Commercial)', ar: 'عمولة عقد إيجار جديد (تجاري)' },
      amount: '10% of annual rent (or AED 1,050 min, VAT inclusive)',
      remarks: { en: 'For each new lease concluded', ar: 'لكل عقد إيجار جديد يتم إبرامه' },
      beneficiary: 'Alwaan',
    },
    {
      service: { en: 'Renewal Fee (Residential)', ar: 'رسوم تجديد العقد (سكني)' },
      amount: 'AED 850 (VAT inclusive)',
      remarks: { en: 'For each tenancy renewal', ar: 'لكل تجديد عقد إيجار' },
      beneficiary: 'Alwaan',
    },
    {
      service: { en: 'Renewal Fee (Commercial)', ar: 'رسوم تجديد العقد (تجاري)' },
      amount: 'AED 1,500 (VAT inclusive)',
      remarks: { en: 'For each tenancy renewal', ar: 'لكل تجديد عقد إيجار' },
      beneficiary: 'Alwaan',
    },
    {
      service: { en: 'EJARI Registration', ar: 'تسجيل إيجاري' },
      amount: 'AED 250 (VAT inclusive)',
      remarks: { en: 'For Dubai properties only', ar: 'للعقارات في إمارة دبي فقط' },
      beneficiary: 'Alwaan',
    },
    {
      service: { en: 'Municipality Service Charge', ar: 'رسوم خدمة البلدية' },
      amount: 'AED 210 (VAT inclusive)',
      remarks: { en: 'For lease registration on Municipality system', ar: 'لتسجيل العقد في نظام البلدية' },
      beneficiary: 'Alwaan',
    },
    {
      service: { en: 'Cheque Replacement', ar: 'استبدال الشيك' },
      amount: 'AED 262.50 (VAT inclusive)',
      remarks: { en: 'Per replacement after receipt issuance', ar: 'لكل استبدال بعد إصدار الإيصال' },
      beneficiary: 'Alwaan',
    },
    {
      service: { en: 'Cheque Postponement', ar: 'تأجيل الشيك' },
      amount: 'AED 262.50 (VAT inclusive)',
      remarks: { en: 'Max 1 month from original date', ar: 'بحد أقصى شهر من التاريخ الأصلي' },
      beneficiary: 'Alwaan',
    },
    {
      service: { en: 'Returned/Bounced Cheque', ar: 'الشيك المرتجع' },
      amount: 'AED 525 (VAT inclusive)',
      remarks: { en: 'For each cheque returned by bank', ar: 'لكل شيك يرتجع من البنك' },
      beneficiary: 'Alwaan',
    },
    {
      service: { en: 'Late Renewal (within 15 days)', ar: 'تأخير التجديد (خلال 15 يوم)' },
      amount: 'AED 525 (VAT inclusive)',
      remarks: { en: 'Renewal within 15 days of expiry', ar: 'تجديد خلال 15 يوم من انتهاء العقد' },
      beneficiary: 'Alwaan',
    },
    {
      service: { en: 'Late Renewal (within 30 days)', ar: 'تأخير التجديد (خلال 30 يوم)' },
      amount: 'AED 1,050 (VAT inclusive)',
      remarks: { en: 'Renewal within 30 days of expiry', ar: 'تجديد خلال 30 يوم من انتهاء العقد' },
      beneficiary: 'Alwaan',
    },
    {
      service: { en: 'Name Change / Lease Transfer (Residential)', ar: 'تغيير الاسم / نقل العقد (سكني)' },
      amount: '5% of annual rent',
      remarks: { en: 'Changing lessor during lease period', ar: 'تغيير المستأجر خلال فترة العقد' },
      beneficiary: 'Alwaan',
    },
    {
      service: { en: 'Name Change / Lease Transfer (Commercial)', ar: 'تغيير الاسم / نقل العقد (تجاري)' },
      amount: '10% of annual rent',
      remarks: { en: 'Changing lessor during lease period', ar: 'تغيير المستأجر خلال فترة العقد' },
      beneficiary: 'Alwaan',
    },
    {
      service: { en: 'Certification Letters', ar: 'رسائل التصديق' },
      amount: 'AED 100',
      remarks: { en: 'Per certification requested by tenant', ar: 'لكل تصديق يطلبه المستأجر' },
      beneficiary: 'Alwaan',
    },
    {
      service: { en: 'Early Termination (Residential)', ar: 'الإنهاء المبكر (سكني)' },
      amount: '2 months annual rent',
      remarks: { en: 'Breaking lease during contract period', ar: 'فسخ العقد خلال فترة التعاقد' },
      beneficiary: 'Landlord',
    },
    {
      service: { en: 'Early Termination (Commercial)', ar: 'الإنهاء المبكر (تجاري)' },
      amount: '3 months annual rent',
      remarks: { en: 'Breaking lease during contract period', ar: 'فسخ العقد خلال فترة التعاقد' },
      beneficiary: 'Landlord',
    },
  ]

  const feeRows = fees.map((f) => `
    <tr>
      <td class="en"><b>${f.service.en}</b><br/><span class="muted">${f.remarks.en}</span></td>
      <td class="ar" dir="rtl"><b>${f.service.ar}</b><br/><span class="muted">${f.remarks.ar}</span></td>
      <td class="amt">${f.amount}</td>
      <td class="ben">${f.beneficiary}</td>
    </tr>`).join('')

  // Custom service-type AR mapping (from editable content)
  const serviceTypeAR: Record<string, string> = C.serviceTypeARMap

  // OWNER OBLIGATIONS (from editable content)
  const ownerObligations: { en: string; ar: string }[] = C.ownerObligations.length ? C.ownerObligations : [
    { en: 'Provide a clear and valid copy of the title deed and proof of ownership of the building.', ar: 'تقديم نسخة سارية وواضحة من سند الملكية وما يثبت ملكية المبنى.' },
    { en: 'Pay all building-related service charges (chiller, A/C central system, fire & life safety, common area maintenance, etc.).', ar: 'دفع جميع رسوم خدمات المبنى (التبريد، نظام التكييف المركزي، أنظمة الحريق والسلامة، صيانة المناطق المشتركة).' },
    { en: 'Maintain a valid building insurance policy covering structure and third-party liability.', ar: 'الاحتفاظ بوثيقة تأمين سارية تغطي هيكل المبنى والمسؤولية تجاه الغير.' },
    { en: 'Approve in writing any major repair or capital expenditure exceeding the agreed approval threshold.', ar: 'الموافقة كتابياً على أي إصلاحات كبيرة أو نفقات رأسمالية تتجاوز سقف الموافقة المتفق عليه.' },
    { en: 'Provide Alwaan with a Power of Attorney or written authorization to act on behalf of the Owner for EJARI registration, legal cases, and government dealings as required.', ar: 'تزويد Alwaan بتوكيل أو تفويض كتابي للتصرف نيابة عن المالك في تسجيل إيجاري، القضايا القانونية، والتعاملات الحكومية.' },
    { en: 'Provide unit/building access for inspections, viewings, and maintenance work.', ar: 'توفير إمكانية الوصول إلى الوحدات/المبنى للفحص والمعاينة وأعمال الصيانة.' },
    { en: 'Settle any outstanding utility bills, fees, or fines existing prior to the handover date.', ar: 'تسوية أي فواتير خدمات أو رسوم أو غرامات معلقة قبل تاريخ التسليم.' },
    { en: 'Notify Alwaan in writing of any changes to ownership, banking details, or contact information.', ar: 'إخطار Alwaan كتابياً بأي تغييرات في الملكية، البيانات المصرفية، أو معلومات الاتصال.' },
    { en: 'Refrain from communicating directly with tenants regarding lease matters during the term of this Agreement; all such communications shall be channeled through Alwaan.', ar: 'الامتناع عن التواصل المباشر مع المستأجرين بشأن أمور الإيجار خلال مدة هذه الاتفاقية؛ تتم جميع الاتصالات عبر Alwaan.' },
  ]

  // Alwaan OBLIGATIONS (from editable content)
  const creObligations: { en: string; ar: string }[] = C.creObligations.length ? C.creObligations : [
    { en: 'Use best efforts to maintain occupancy levels above 90% through active marketing and competitive pricing.', ar: 'بذل قصارى الجهود للحفاظ على معدل إشغال يتجاوز 90% من خلال التسويق النشط والتسعير التنافسي.' },
    { en: 'Collect rent on the contractually agreed due dates and deposit cheques on the same day of receipt where possible.', ar: 'تحصيل الإيجارات في تواريخ الاستحقاق المتعاقد عليها وإيداع الشيكات في نفس يوم استلامها قدر الإمكان.' },
    { en: 'Respond to tenant complaints and maintenance requests within 24 hours and resolve urgent matters within 72 hours.', ar: 'الاستجابة لشكاوى المستأجرين وطلبات الصيانة خلال 24 ساعة وحل الأمور العاجلة خلال 72 ساعة.' },
    { en: 'Submit monthly financial statements to the Owner by the 7th of each month, and quarterly performance reports.', ar: 'تقديم كشوف مالية شهرية للمالك بحلول السابع من كل شهر، وتقارير أداء ربع سنوية.' },
    { en: 'Maintain the property in compliance with RERA, DLD, EJARI, Civil Defence, and Municipality regulations.', ar: 'الحفاظ على العقار بما يتوافق مع لوائح RERA، DLD، إيجاري، الدفاع المدني، والبلدية.' },
    { en: 'Ensure full transparency: every transaction, payment, and document is recorded in the Property Management System (PMS) and accessible to the Owner via the Owner Portal.', ar: 'ضمان الشفافية الكاملة: تسجيل كل معاملة ودفعة ومستند في نظام إدارة العقار (PMS) وإتاحتها للمالك عبر بوابة المالك.' },
    { en: 'Maintain confidentiality of Owner financial data and tenant personal information in accordance with UAE Personal Data Protection Law (PDPL).', ar: 'الحفاظ على سرية البيانات المالية للمالك والمعلومات الشخصية للمستأجرين وفقاً لقانون حماية البيانات الشخصية لدولة الإمارات.' },
    { en: 'Initiate legal action against defaulting tenants only after Owner approval, except in pre-agreed standard procedures (e.g., bounced cheque recovery).', ar: 'بدء الإجراءات القانونية ضد المستأجرين المتعثرين بعد موافقة المالك فقط، باستثناء الإجراءات القياسية المتفق عليها مسبقاً (مثل استرداد الشيكات المرتجعة).' },
    { en: 'Conduct quarterly market benchmarking studies and recommend rent adjustments accordingly.', ar: 'إجراء دراسات مرجعية للسوق ربع سنوية والتوصية بتعديلات الإيجار وفقاً لذلك.' },
    { en: 'Maintain the original tenant files and all related documentation in safe and restricted-access custody.', ar: 'الاحتفاظ بملفات المستأجرين الأصلية وجميع الوثائق ذات الصلة في حافظة آمنة ومقيدة الوصول.' },
  ]

  // REPORTING (from editable content)
  const reports: { en: string; ar: string; freq: string }[] = C.reports.length ? C.reports : [
    { en: 'Expired Leases Report', ar: 'تقرير العقود المنتهية', freq: 'Monthly / شهري' },
    { en: 'Renewal Notices Report', ar: 'تقرير إشعارات التجديد', freq: 'Monthly / شهري' },
    { en: 'Expected Renewals Report', ar: 'تقرير التجديدات المتوقعة', freq: 'Monthly / شهري' },
    { en: 'New Leads Report', ar: 'تقرير العملاء المحتملين', freq: 'Monthly / شهري' },
    { en: 'Unit Availability Report', ar: 'تقرير الوحدات المتاحة', freq: 'Weekly / أسبوعي' },
    { en: 'Property Performance Report', ar: 'تقرير أداء العقار', freq: 'Monthly / شهري' },
    { en: 'PDC (Post-Dated Cheques) Report', ar: 'تقرير الشيكات الآجلة', freq: 'Monthly / شهري' },
    { en: 'Bounced Cheques Report', ar: 'تقرير الشيكات المرتجعة', freq: 'Monthly / شهري' },
    { en: 'Legal Updates Report', ar: 'تقرير التحديثات القانونية', freq: 'Bi-Weekly / نصف شهري' },
    { en: 'Building Condition Report', ar: 'تقرير حالة المبنى', freq: 'Quarterly / ربع سنوي' },
    { en: 'Financial Statement (Income/Expenses)', ar: 'البيان المالي (الدخل/المصروفات)', freq: 'Monthly / شهري' },
    { en: 'CSAT (Customer Satisfaction) Report', ar: 'تقرير رضا العملاء', freq: 'Quarterly / ربع سنوي' },
  ]

  const reportRows = reports.map((r) => `
    <tr>
      <td class="en">${r.en}</td>
      <td class="ar" dir="rtl">${r.ar}</td>
      <td class="freq">${r.freq}</td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Property Management Agreement – ${o.buildingName}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&family=Playfair+Display:wght@600;700;800&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 22mm 20mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Times New Roman', Times, serif;
    color: #000;
    font-size: 11pt;
    line-height: 1.55;
    margin: 0;
    padding: 0;
    background: #fff;
  }
  .ar-text { font-family: 'Cairo', sans-serif; font-size: 11pt; }

  /* HEADER */
  .doc-header {
    text-align: center;
    padding-bottom: 12px;
    margin-bottom: 18px;
    border-bottom: 1px solid #000;
  }
  .doc-header img { height: 60px; margin-bottom: 8px; }
  .doc-header .crest {
    font-size: 10pt;
    letter-spacing: 2px;
    color: #000;
    font-weight: 600;
  }
  .doc-header h1 {
    font-family: 'Times New Roman', serif;
    font-size: 18pt;
    margin: 8px 0 4px;
    color: #000;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .doc-header h1 .ar-h {
    font-family: 'Cairo', sans-serif;
    font-size: 16pt;
    margin-right: 10px;
    font-weight: 700;
  }
  .doc-header .sub {
    font-size: 9.5pt;
    color: #555;
    margin-top: 4px;
  }
  .meta {
    display: flex;
    justify-content: space-between;
    font-size: 10pt;
    color: #000;
    margin-bottom: 16px;
    padding: 0;
  }
  .meta strong { font-weight: 600; }

  /* SECTION HEADERS - simple */
  .section-h {
    margin: 22px 0 10px;
    padding: 0 0 4px;
    border-bottom: 1px solid #000;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    page-break-after: avoid;
    color: #000;
  }
  .sec-num {
    font-size: 11pt;
    font-weight: 700;
    margin-right: 8px;
    flex-shrink: 0;
  }
  .sec-en {
    font-size: 11.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    flex: 1;
  }
  .sec-ar {
    font-family: 'Cairo', sans-serif;
    font-size: 12pt;
    font-weight: 700;
    flex: 0 0 auto;
    text-align: right;
  }

  /* BILINGUAL ROWS - simple */
  .bi-row {
    display: flex;
    gap: 18px;
    padding: 5px 0;
  }
  .bi-en {
    flex: 1;
    text-align: justify;
  }
  .bi-ar {
    flex: 1;
    text-align: justify;
    font-family: 'Cairo', sans-serif;
    font-size: 11pt;
    line-height: 1.7;
  }

  /* BILINGUAL LIST ITEMS */
  .bi-li {
    display: flex;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px dotted #eee;
    align-items: flex-start;
  }
  .bi-li:last-child { border-bottom: none; }
  .bi-li {
    padding: 4px 0;
    page-break-inside: avoid;
  }
  .bi-li-num {
    flex-shrink: 0;
    width: 24px;
    font-weight: 600;
    color: #000;
    font-size: 11pt;
  }
  .bi-li-en {
    flex: 1;
    text-align: justify;
  }
  .bi-li-ar {
    flex: 1;
    text-align: justify;
    font-family: 'Cairo', sans-serif;
    font-size: 11pt;
    line-height: 1.7;
  }

  /* PARTY CARDS - simple boxes */
  .party-block {
    display: flex;
    gap: 16px;
    margin: 10px 0;
  }
  .party-card {
    flex: 1;
    border: 1px solid #000;
    padding: 12px 14px;
    background: #fff;
  }
  .party-card h3 {
    margin: 0 0 8px;
    color: #000;
    font-size: 10.5pt;
    border-bottom: 1px solid #000;
    padding-bottom: 4px;
    display: flex;
    justify-content: space-between;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .party-card h3 .h-ar { font-family: 'Cairo', sans-serif; font-size: 11pt; text-transform: none; letter-spacing: 0; }
  .kv { font-size: 10pt; line-height: 1.6; }
  .kv .k {
    color: #000;
    display: inline-block;
    width: 130px;
    font-weight: 600;
  }
  .kv .v { color: #000; }

  /* TABLES - simple */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0 14px;
    page-break-inside: avoid;
    font-size: 10pt;
  }
  th, td {
    border: 1px solid #000;
    padding: 6px 9px;
    vertical-align: top;
  }
  th {
    background: #f2f2f2;
    color: #000;
    font-weight: 700;
    text-align: left;
    font-size: 10pt;
  }
  th.center, td.center { text-align: center; }
  td.num { text-align: center; width: 30px; }
  td.en { width: 35%; }
  td.ar { width: 35%; font-family: 'Cairo', sans-serif; font-size: 10.5pt; }
  td.amt { width: 22%; font-weight: 600; }
  td.ben { width: 14%; text-align: center; font-weight: 600; }
  td.check { width: 30px; text-align: center; font-weight: bold; }
  td.freq { width: 25%; text-align: center; }
  .muted { color: #555; font-size: 9.5pt; }

  /* SIGNATURES - clean */
  .signatures {
    margin-top: 32px;
    page-break-inside: avoid;
  }
  .sig-row {
    display: flex;
    gap: 28px;
    margin-bottom: 28px;
  }
  .sig-box {
    flex: 1;
    border-top: 1px solid #000;
    padding-top: 6px;
    font-size: 10pt;
    color: #000;
    min-height: 80px;
  }
  .sig-box .role {
    font-weight: 700;
    color: #000;
    margin-bottom: 24px;
    font-size: 10pt;
    display: flex;
    justify-content: space-between;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .sig-box .role .ar-r { font-family: 'Cairo', sans-serif; text-transform: none; letter-spacing: 0; font-size: 11pt; }
  .sig-box .name-line { margin-top: 3px; color: #000; font-size: 10pt; }

  /* SEAL */
  .seal-area {
    display: flex;
    gap: 28px;
    margin-top: 16px;
  }
  .seal {
    flex: 1;
    border: 1px solid #000;
    padding: 28px;
    text-align: center;
    color: #555;
    font-size: 9.5pt;
  }

  /* FOOTER */
  .footer-note {
    margin-top: 28px;
    font-size: 9pt;
    color: #000;
    text-align: center;
    border-top: 1px solid #000;
    padding-top: 8px;
    line-height: 1.5;
  }
  .footer-note .ar-f { font-family: 'Cairo', sans-serif; font-size: 9.5pt; }

  /* PREAMBLE */
  .preamble {
    padding: 8px 0;
    margin: 10px 0 16px;
    font-size: 10.5pt;
    color: #000;
    text-align: justify;
  }

  @media print {
    body { padding: 0; }
    .section-h { page-break-after: avoid; }
    table, .party-block, .signatures, .seal-area { page-break-inside: avoid; }
  }
</style>
</head>
<body>

<!-- HEADER -->
<div class="doc-header">
  
  <div class="crest">CONTINENTAL REAL ESTATE</div>
  <h1>Property Management Agreement <span class="ar-h">اتفاقية إدارة عقار</span></h1>
  <div class="sub">Governed by UAE Federal Law and Dubai Real Estate Law No. 26 of 2007</div>
</div>

<!-- META -->
<div class="meta">
  <div><strong>Agreement Reference:</strong> ${refNo}</div>
  <div><strong>Date Issued:</strong> ${today}</div>
  <div><strong>Building:</strong> ${o.buildingName}</div>
</div>

<!-- PREAMBLE -->
<div class="preamble">
  <div>${C.preambleEn}</div>
  <div class="ar-text" dir="rtl" style="margin-top:6px">${C.preambleAr}</div>
</div>

<!-- SECTION 1: PARTIES -->
${biH('1', C.sectionHeaders.s1En, C.sectionHeaders.s1Ar)}
<div class="party-block">
  <div class="party-card">
    <h3><span>OWNER (FIRST PARTY)</span><span class="h-ar" dir="rtl">المالك (الطرف الأول)</span></h3>
    <div class="kv">
      <div><span class="k">Name / الاسم:</span> <span class="v">${tenantSafe(o.ownerName)}</span></div>
      <div><span class="k">Type / النوع:</span> <span class="v">${o.ownerType}</span></div>
      <div><span class="k">Emirates ID:</span> <span class="v">${tenantSafe(o.emiratesId)}</span></div>
      <div><span class="k">Passport No:</span> <span class="v">${tenantSafe(o.passportNo)}</span></div>
      <div><span class="k">Nationality:</span> <span class="v">${tenantSafe(o.nationality)}</span></div>
      <div><span class="k">Phone:</span> <span class="v">${tenantSafe(o.phone)}</span></div>
      <div><span class="k">Email:</span> <span class="v">${tenantSafe(o.email)}</span></div>
      <div><span class="k">Address:</span> <span class="v">${tenantSafe(o.address)}</span></div>
      <div><span class="k">Bank:</span> <span class="v">${tenantSafe(o.bankName)}</span></div>
      <div><span class="k">IBAN:</span> <span class="v">${tenantSafe(o.iban)}</span></div>
      ${o.ownerType === 'Company' ? `<div><span class="k">Trade License:</span> <span class="v">${tenantSafe(o.tradeLicense)}</span></div>` : ''}
    </div>
  </div>
  <div class="party-card">
    <h3><span>PROPERTY MANAGER (SECOND PARTY)</span><span class="h-ar" dir="rtl">مدير العقار (الطرف الثاني)</span></h3>
    <div class="kv">
      <div><span class="k">Company / الشركة:</span> <span class="v">Alwaan L.L.C.</span></div>
      <div><span class="k">Type / النوع:</span> <span class="v">Property Management Company</span></div>
      <div><span class="k">RERA License:</span> <span class="v">_______________</span></div>
      <div><span class="k">Trade License:</span> <span class="v">_______________</span></div>
      <div><span class="k">Address:</span> <span class="v">Dubai, United Arab Emirates</span></div>
      <div><span class="k">Phone:</span> <span class="v">+971 _______</span></div>
      <div><span class="k">Email:</span> <span class="v">info@alwaan.ae</span></div>
      <div><span class="k">Website:</span> <span class="v">www.alwaan.ae</span></div>
    </div>
  </div>
</div>

<!-- SECTION 2: PROPERTY DETAILS -->
${biH('2', C.sectionHeaders.s2En, C.sectionHeaders.s2Ar)}
<table>
  <tr>
    <th>Field / الحقل</th>
    <th>Details / التفاصيل</th>
  </tr>
  <tr><td><b>Building Name</b><br/><span class="ar-text" dir="rtl">اسم المبنى</span></td><td>${tenantSafe(o.buildingName)}</td></tr>
  <tr><td><b>Building Type</b><br/><span class="ar-text" dir="rtl">نوع المبنى</span></td><td>${o.buildingType} ${isCommercial ? '(Commercial / تجاري)' : '(Residential / سكني)'}</td></tr>
  <tr><td><b>Emirate</b><br/><span class="ar-text" dir="rtl">الإمارة</span></td><td>${o.emirate}</td></tr>
  <tr><td><b>Area / Location</b><br/><span class="ar-text" dir="rtl">المنطقة</span></td><td>${tenantSafe(o.area)}</td></tr>
  <tr><td><b>Plot Number</b><br/><span class="ar-text" dir="rtl">رقم القطعة</span></td><td>${tenantSafe(o.plotNo)}</td></tr>
  <tr><td><b>Makani Number</b><br/><span class="ar-text" dir="rtl">رقم مكاني</span></td><td>${tenantSafe(o.makaniNo)}</td></tr>
  <tr><td><b>Title Deed No</b><br/><span class="ar-text" dir="rtl">رقم سند الملكية</span></td><td>${tenantSafe(o.titleDeedNo)}</td></tr>
  <tr><td><b>Total Units</b><br/><span class="ar-text" dir="rtl">إجمالي الوحدات</span></td><td>${o.totalUnits}</td></tr>
  <tr><td><b>Total Floors</b><br/><span class="ar-text" dir="rtl">إجمالي الطوابق</span></td><td>${o.totalFloors}</td></tr>
  <tr><td><b>Parking Spaces</b><br/><span class="ar-text" dir="rtl">مواقف السيارات</span></td><td>${o.parkingSpaces}</td></tr>
  <tr><td><b>Year Built</b><br/><span class="ar-text" dir="rtl">سنة البناء</span></td><td>${tenantSafe(o.yearBuilt)}</td></tr>
  ${o.buildingDescription ? `<tr><td><b>Description</b><br/><span class="ar-text" dir="rtl">الوصف</span></td><td>${o.buildingDescription}</td></tr>` : ''}
</table>

${primaryImagePath ? `
<!-- BUILDING PHOTO -->
<div class="preamble" style="text-align:center; margin-top:14px;">
  <div style="font-weight:600; font-size:12px; color:#1a1a1a; margin-bottom:6px;">
    Building Photo / <span dir="rtl">صورة المبنى</span>
  </div>
  <img src="${baseUrl}${primaryImagePath}" alt="Building photo"
    style="max-width:360px; max-height:240px; width:auto; height:auto; border:1px solid #ccc; border-radius:6px; object-fit:cover;" />
</div>
` : ''}

<!-- SECTION 3: TERM -->
${biH('3', C.sectionHeaders.s3En, C.sectionHeaders.s3Ar)}
<table>
  <tr>
    <th>Term / المدة</th>
    <th>Details / التفاصيل</th>
  </tr>
  <tr><td><b>Service Type</b><br/><span class="ar-text" dir="rtl">نوع الخدمة</span></td><td>${o.serviceType} <br/> <span class="ar-text" dir="rtl">${serviceTypeAR[o.serviceType] || o.serviceType}</span></td></tr>
  <tr><td><b>Contract Start Date</b><br/><span class="ar-text" dir="rtl">تاريخ بداية العقد</span></td><td>${tenantSafe(o.contractStartDate)}</td></tr>
  <tr><td><b>Contract End Date</b><br/><span class="ar-text" dir="rtl">تاريخ نهاية العقد</span></td><td>${tenantSafe(o.contractEndDate)}</td></tr>
  <tr><td><b>Contract Term</b><br/><span class="ar-text" dir="rtl">مدة العقد</span></td><td>${o.contractTerm}</td></tr>
  <tr><td><b>Auto-Renewal</b><br/><span class="ar-text" dir="rtl">التجديد التلقائي</span></td><td>${o.autoRenew ? 'Yes / نعم — auto-renew unless either party gives written notice as per termination clause' : 'No / لا — requires written renewal'}</td></tr>
  <tr><td><b>Notice Period</b><br/><span class="ar-text" dir="rtl">فترة الإشعار</span></td><td>${o.noticePeriodDays} days written notice required for termination<br/><span class="ar-text" dir="rtl">يلزم إشعار كتابي قبل ${o.noticePeriodDays} يوماً للإنهاء</span></td></tr>
  <tr><td><b>Mandate Type</b><br/><span class="ar-text" dir="rtl">نوع التفويض</span></td><td>${o.exclusiveMandate ? 'Exclusive Mandate / تفويض حصري — Owner shall not appoint another PM company during this term' : 'Non-Exclusive / غير حصري'}</td></tr>
</table>

<!-- SECTION 4: SCOPE OF SERVICES -->
${biH('4', C.sectionHeaders.s4En, C.sectionHeaders.s4Ar)}
<table>
  <tr>
    <th class="center">#</th>
    <th>Service (English)</th>
    <th>الخدمة</th>
    <th class="center">Included</th>
  </tr>
  ${serviceRows}
</table>
${o.customCommissionNotes ? `<div class="preamble"><strong>Additional Services / Notes:</strong><br/>${o.customCommissionNotes}</div>` : ''}

<!-- SECTION 5: COMMISSION & FEES -->
${biH('5', C.sectionHeaders.s5En, C.sectionHeaders.s5Ar)}
<table>
  <tr>
    <th>Service (English)</th>
    <th>الخدمة</th>
    <th>Amount / المبلغ</th>
    <th class="center">Beneficiary / المستفيد</th>
  </tr>
  ${feeRows}
</table>
<div class="preamble">
  <strong>Note:</strong> ${C.feesFooterEn}
  <div class="ar-text" dir="rtl" style="margin-top:6px"><strong>ملاحظة:</strong> ${C.feesFooterAr}</div>
</div>

<!-- SECTION 6: OWNER OBLIGATIONS -->
${biH('6', C.sectionHeaders.s6En, C.sectionHeaders.s6Ar)}
<div class="bi-list">
  ${ownerObligations.map((c, i) => biLi(i + 1, c.en, c.ar)).join('')}
</div>

<!-- SECTION 7: Alwaan OBLIGATIONS -->
${biH('7', C.sectionHeaders.s7En, C.sectionHeaders.s7Ar)}
<div class="bi-list">
  ${creObligations.map((c, i) => biLi(i + 1, c.en, c.ar)).join('')}
</div>

<!-- SECTION 8: PAYMENT TO OWNER -->
${biH('8', C.sectionHeaders.s8En, C.sectionHeaders.s8Ar)}
${C.paymentToOwner.map(p => bi(tpl(p.en), tpl(p.ar))).join('')}

<!-- SECTION 9: REPORTING OBLIGATIONS -->
${biH('9', C.sectionHeaders.s9En, C.sectionHeaders.s9Ar)}
<table>
  <tr>
    <th>Report (English)</th>
    <th>التقرير</th>
    <th class="center">Frequency / التكرار</th>
  </tr>
  ${reportRows}
</table>

<!-- SECTION 10: KPIs -->
${biH('10', C.sectionHeaders.s10En, C.sectionHeaders.s10Ar)}
<table>
  <tr>
    <th>KPI / المؤشر</th>
    <th>Target / الهدف</th>
  </tr>
  ${C.kpis.map(k => `<tr><td><b>${k.labelEn}</b><br/><span class="ar-text" dir="rtl">${k.labelAr}</span></td><td>${k.target}</td></tr>`).join('')}
</table>

<!-- SECTION 11: TERMINATION -->
${biH('11', C.sectionHeaders.s11En, C.sectionHeaders.s11Ar)}
${C.termination.map(t => bi(tpl(t.en), tpl(t.ar))).join('')}

<!-- SECTION 12: CONFIDENTIALITY -->
${biH('12', C.sectionHeaders.s12En, C.sectionHeaders.s12Ar)}
${C.confidentiality.map(t => bi(tpl(t.en), tpl(t.ar))).join('')}

<!-- SECTION 13: DISPUTE RESOLUTION -->
${biH('13', C.sectionHeaders.s13En, C.sectionHeaders.s13Ar)}
${C.disputeResolution.map(t => bi(tpl(t.en), tpl(t.ar))).join('')}

<!-- SECTION 14: GOVERNING LAW -->
${biH('14', C.sectionHeaders.s14En, C.sectionHeaders.s14Ar)}
${C.governingLaw.map(t => bi(tpl(t.en), tpl(t.ar))).join('')}

<!-- SECTION 15: SIGNATURES -->
${biH('15', C.sectionHeaders.s15En, C.sectionHeaders.s15Ar)}
<div class="signatures">
  <div class="sig-row">
    <div class="sig-box">
      <div class="role"><span>OWNER (FIRST PARTY)</span><span class="ar-r" dir="rtl">المالك (الطرف الأول)</span></div>
      <div class="name-line">Name: ${tenantSafe(o.signedByOwnerName || o.ownerName)}</div>
      <div class="name-line">EID: ${tenantSafe(o.emiratesId)}</div>
      ${o.ownerSignatureImage ? `
        <div class="name-line">Date: ${fmtSigDate(o.ownerSignedAt)}</div>
        <img src="${o.ownerSignatureImage}" alt="Owner signature" style="max-height:60px;display:block;margin:4px 0;border-bottom:1px solid #333;padding-bottom:2px" />
        <div class="name-line" style="font-size:10px;color:#555">Electronically signed${o.ownerIpAddress ? ` · IP: ${o.ownerIpAddress}` : ''}</div>
      ` : `
        <div class="name-line">Date: _____________________</div>
        <div class="name-line">Signature: _____________________</div>
      `}
    </div>
    <div class="sig-box">
      <div class="role"><span>Alwaan (SECOND PARTY)</span><span class="ar-r" dir="rtl">Alwaan (الطرف الثاني)</span></div>
      <div class="name-line">Name: ${tenantSafe(o.signedByCREName || '')}</div>
      <div class="name-line">Title: Director / Property Management</div>
      ${o.creSignatureImage ? `
        <div class="name-line">Date: ${fmtSigDate(o.creSignedAt)}</div>
        <img src="${o.creSignatureImage}" alt="Alwaan signature" style="max-height:60px;display:block;margin:4px 0;border-bottom:1px solid #333;padding-bottom:2px" />
        <div class="name-line" style="font-size:10px;color:#555">Electronically counter-signed</div>
      ` : `
        <div class="name-line">Date: _____________________</div>
        <div class="name-line">Signature: _____________________</div>
      `}
    </div>
  </div>
  <div class="sig-row">
    <div class="sig-box">
      <div class="role"><span>WITNESS 1</span><span class="ar-r" dir="rtl">الشاهد الأول</span></div>
      <div class="name-line">Name: _____________________</div>
      <div class="name-line">EID: _____________________</div>
      <div class="name-line">Date: _____________________</div>
      <div class="name-line">Signature: _____________________</div>
    </div>
    <div class="sig-box">
      <div class="role"><span>WITNESS 2</span><span class="ar-r" dir="rtl">الشاهد الثاني</span></div>
      <div class="name-line">Name: _____________________</div>
      <div class="name-line">EID: _____________________</div>
      <div class="name-line">Date: _____________________</div>
      <div class="name-line">Signature: _____________________</div>
    </div>
  </div>
  <div class="seal-area">
    <div class="seal">OWNER STAMP / SEAL<br/><span class="ar-text" dir="rtl">ختم المالك</span></div>
    <div class="seal">Alwaan COMPANY STAMP / SEAL<br/><span class="ar-text" dir="rtl">ختم الشركة</span></div>
  </div>
</div>

<!-- FOOTER -->
<div class="footer-note">
  <div>${C.footerNoteEn}</div>
  <div class="ar-f" dir="rtl">${C.footerNoteAr}</div>
  <div style="margin-top:8px"><strong>Alwaan</strong> &middot; Dubai, United Arab Emirates &middot; www.alwaan.ae &middot; info@alwaan.ae</div>
  <div>Generated: ${today} &middot; Reference: ${refNo}</div>
</div>

</body>
</html>`
}
