import { formatCurrency, formatDate } from '@/lib/utils'

export type TenantRecord = {
  id: string
  name: string
  phone: string
  email: string
  emiratesId: string
  passportNo: string
  nationality: string
  emergencyContactName: string
  emergencyContactPhone: string
  visaNo: string
  visaExpiry: string
  emiratesIdExpiry: string
  passportExpiry: string
  occupation: string
  employer: string
  familySize: number
  isCompany: boolean
  companyName: string
  companyTradeLicense: string
  companyTradeLicenseExpiry: string
  signatoryName: string
  signatoryTitle: string
}

export type UnitRecord = {
  id: string
  unitNo: string
  unitType: string
  currentRent: number
}

export type OwnerRecord = {
  id: string
  ownerName: string
  ownerType: string
  emiratesId: string
  nationality: string
  email: string
  phone: string
  buildingName: string
  buildingType: string
  emirate: string
  area: string
  plotNo: string
  makaniNo: string
  titleDeedNo: string
}

export type TenancyContractRecord = {
  id: string
  contractNo: string
  version: number
  status: string
  contractStart: string
  contractEnd: string
  graceStart: string
  rentAmount: number
  rentInWords: string
  numberOfCheques: number
  securityDeposit: number
  bookingAmount: number
  contractType: string
  purpose: string
  ejariFee: number
  municipalityFee: number
  commissionFee: number
  signatureToken: string
}

export type BuildTenancyContractInput = {
  tenant: TenantRecord
  unit: UnitRecord
  owner: OwnerRecord | null
  contract: TenancyContractRecord
  orgName: string
  baseUrl: string
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

const CLAUSES: Array<{ en: string; ar: string }> = [
  {
    en: 'The tenant is obligated to provide all documents and fees necessary to attest the tenancy contract. The tenant will bear legal responsibility if he does not pay the fees or provides correct documents.',
    ar: 'يلتزم المستأجر بتزويدنا بكافة المستندات والرسوم اللازمة لتصديق عقد الايجار، سيتحمل المستأجر المسؤولية القانونية في حال لم يقم بدفع الرسوم او توفير المستندات الصحيحة.',
  },
  {
    en: 'The annual contract renewal fee is AED 850 (VAT inclusive) for residential. AED 1,500 (VAT inclusive) for commercial.',
    ar: 'رسوم تجديد العقد السنوية هي 850 درهم (شامل الضريبة) للعقود السكنية. و1,500 درهم (شامل الضريبة) للعقود التجارية.',
  },
  {
    en: 'If late renewal 15 days, fine 525 AED. If late 30 days, fine 1,050 AED.',
    ar: 'في حال تأخر المستأجر عن تجديد العقد لمدة 15 يوم، يتم دفع غرامة وقدرها 525 درهم. و في حال تأخر المستأجر عن تجديد العقد لمدة 30 يوم يتم دفع غرامة و قدرها 1,050 درهم.',
  },
  {
    en: 'Cheque postponement fee 262.50 AED (max 1 month from original date).',
    ar: 'رسوم تأجيل الشيك هي 262.50 درهم. ويتم تأجيل الشيك لمدة أقصاها شهر من تاريخ إيداع الشيك الأصلي.',
  },
  {
    en: 'Returned cheque fine 525 AED. Failure to pay = legal action and tenant bears all expenses.',
    ar: 'في حالة رجوع الشيك من البنك تفرض غرامة قدرها 525 درهم. في حالة عدم الدفع يكون للمالك الحق في إتخاذ جميع الإجراءات القانونية ويكون المستأجر مسئولا عن جميع المصروفات.',
  },
  {
    en: 'Both tenant and cheque drawer are legally liable for cheque authenticity if 3rd party. Must provide passport copy, valid visa, undertaking from third party. Company cheques require trade license.',
    ar: 'كلا المستأجر وساحب الشيك مسئولين قانونا عن صحة وصلاحية الشيكات في حالة إصدار شيكات من قبل طرف ثالث. يقدم المستأجر صورة جواز سفر، تأشيرة سارية وتعهد. الشيكات الصادرة من شركة يتم تقديم رخصة تجارية.',
  },
  {
    en: 'Tenant pays security deposit and recurring charges, fines for Electricity, Water, Sewerage.',
    ar: 'يقوم المستأجر بدفع تأمين خدمات الكهرباء والماء والصرف الصحي ويتحمل أية غرامات.',
  },
  {
    en: 'Tenant must submit photocopies of passport and/or trade license before signing. Family member passport copies may be requested.',
    ar: 'على المستأجر تقديم صورة من جواز سفره و/أو رخصة تجارية قبل التوقيع. على المستأجر تقديم صور من جوازات سفر أفراد أسرته.',
  },
  {
    en: 'Tenant has no right to modify/alter premises, sub-lease, change name, share with non-relatives, or transfer without written consent.',
    ar: 'ليس للمستأجر الحق في تعديل/تبديل العين المستأجرة، التأجير من الباطن، مشاركة الوحدة مع أشخاص غير الأسرة أو نقل العقد بدون موافقة كتابية.',
  },
  {
    en: 'Security deposit 5% (residential) or as advised by landlord, refunded after handing over flat in good condition & settling final bills.',
    ar: 'على المستأجر دفع ضمان مالي قدره 5% من قيمة عقد الإيجار يتم استرداده بعد تسليم الشقة بحالة جيدة وتسوية الفواتير النهائية.',
  },
  {
    en: 'Owner carries out regular maintenance for AC and firefighting systems. Schedule informed in advance. Tenant must allow access.',
    ar: 'يقوم المالك بإجراء أعمال الصيانة الدورية لمكيفات الهواء وأنظمة مكافحة الحريق، وسيتم إشعار المستأجر بالبرنامج الزمني وعلى المستأجر تمكين فريق الصيانة.',
  },
  {
    en: "Additional maintenance charges (labor + material) charged to tenant if due to misuse. Landlord's Maintenance Department decision is final.",
    ar: 'أية تكاليف صيانة إضافية يتحملها المستأجر إن كانت الصيانة نتيجة سوء استخدام. ويكون قرار قسم الصيانة نهائيا.',
  },
  {
    en: 'Tenant must use apartment for residential purpose only. No illegal/immoral activities or disturbance.',
    ar: 'على المستأجر استخدام الشقة لغرض السكن فقط. وعدم التورط في أنشطة غير قانونية أو غير أخلاقية أو تسبب إزعاجا.',
  },
  {
    en: 'No laundry on balconies.',
    ar: 'يمنع منعا باتا نشر الغسيل أو تعليق أي أغراض على الشرفة.',
  },
  {
    en: 'No barbeque inside flat or balcony (Civil Defence regulation).',
    ar: 'يمنع منعا باتا استخدام الشوايات داخل الوحدة أو في الشرفات وفقا لتعليمات الدفاع المدني.',
  },
  {
    en: 'No pets (cats, dogs etc.) in flat or building.',
    ar: 'يمنع منعا باتا الإحتفاظ بالحيوانات مثل القطط، الكلاب داخل الشقة أو في أي جزء من المبنى.',
  },
  {
    en: 'Children must not play in parking area.',
    ar: 'على المستأجرين التأكد من عدم لعب أطفالهم في منطقة مواقف السيارات.',
  },
  {
    en: 'No smoking in common areas (corridor, entrance, lifts, parking).',
    ar: 'التدخين غير مسموح به في المناطق العامة المشتركة.',
  },
  {
    en: 'Children should use lift only when accompanied by an adult.',
    ar: 'على المستأجر التأكد من عدم إستخدام أطفالهم للمصاعد إلا بصحبة شخص راشد.',
  },
  {
    en: 'Tenant must not throw water or items from balconies/windows.',
    ar: 'يتعهد المستأجرون بعدم رمي المياه أو أي مخلفات من الشرفات أو نوافذ الشقة.',
  },
  {
    en: 'Garbage only through chutes. Strict action against violators placing bags elsewhere.',
    ar: 'يتم التخلص من النفايات من خلال مرمى النفايات، يمنع وضع أكياس النفايات في أية منطقة أخرى وسيتم إتخاذ إجراء حاسم ضد المخالفين.',
  },
  {
    en: 'No glue carpets on flooring. Wallpapers/water paint must be returned to original state. Oil paint not allowed anywhere.',
    ar: 'سجاد الأرضيات بالصمغ غير مسموح به، ورق الجدران اللاصق أو الأصباغ المائية يجب على المستأجر إزالتها قبل الإخلاء، صبغ الجدران بالألوان الزيتية غير مسموح.',
  },
  {
    en: "No dish antennas on roof or balconies. Landlord may remove unauthorized installations at tenant's cost without notice.",
    ar: 'لا يسمح بتركيب صحون هوائية في أعلى السطح أو على الشرفات، يحتفظ المالك بالحق في إزالة التركيبات غير المصرح بها على نفقة المستأجر بدون إشعار مسبق.',
  },
  {
    en: 'Tenant must inform management before vacation for utility disconnection (Electricity/Water/Gas).',
    ar: 'على المستأجر إشعار الإدارة قبل الذهاب في إجازة لفصل الكهرباء والماء والغاز تفاديا لأية تسريبات أو أعطال.',
  },
  {
    en: 'Inform Management Office before major furniture changing/shifting. No damage to building or disturbance to others.',
    ar: 'على المستأجر إفادة مكتب الإدارة قبل نقل أثاث كبير الحجم والتأكد من عدم إزعاج المستأجرين الآخرين.',
  },
  {
    en: 'No items in corridors or staircase (bicycles, shoe racks). Management not responsible for damage/loss.',
    ar: 'على المستأجر عدم الاحتفاظ بأي أغراض في الممرات أو منطقة الدرج. لن تكون الإدارة مسئولة عن أي أضرار أو خسائر.',
  },
  {
    en: 'Landlord not responsible for damages to electronic/electrical equipment. No drilling holes or fixing items on walls/ceiling without written permission.',
    ar: 'المالك غير مسئول عن أية أضرار للمعدات الإلكترونية والكهربائية. على المستأجر عدم حفر أو تركيب أي مفروشات بدون موافقة خطية.',
  },
  {
    en: 'Tenant must give written confirmation of renewal at least 2 months before expiry. Otherwise auto-renewed. Vacating after expiry = break lease + penalty.',
    ar: 'على المستأجر إبلاغ الإدارة خطيا برغبته في تجديد العقد قبل شهرين من الانتهاء. وإلا سيعتبر مجدد تلقائيا. الإلغاء بعد تاريخ الانتهاء = فسخ العقد وتطبيق غرامة الفسخ.',
  },
  {
    en: 'In case of vacating, tenant must inform owner in writing at least 2 months in advance.',
    ar: 'في حالة إخلاء الشقة، على المستأجر إشعار إدارة المبنى خطيا قبل شهرين.',
  },
  {
    en: 'Contract cancellation during tenure: Residential = 2 months rent, Commercial = 3 months rent.',
    ar: 'في حال إخلاء العقار قبل إنتهاء فترة التعاقد، تفرض غرامة قدرها ايجار شهرين (سكني) أو 3 أشهر (تجاري).',
  },
  {
    en: 'Tenant must pay all DEWA/SEWA dues and provide final bill before vacating.',
    ar: 'على المستأجر دفع جميع مستحقات الكهرباء والماء والصرف الصحي وتقديم الفاتورة النهائية قبل الإخلاء.',
  },
]

export function buildTenancyContractHTML(data: BuildTenancyContractInput): string {
  const { tenant, unit, owner, contract, baseUrl } = data
  const today = formatDate(new Date())
  const startDate = contract.contractStart ? formatDate(contract.contractStart) : '__________'
  const endDate = contract.contractEnd ? formatDate(contract.contractEnd) : '__________'
  const graceDate = contract.graceStart ? formatDate(contract.graceStart) : '__________'
  const isResidential = (contract.contractType || 'Residential').toLowerCase() === 'residential'
  const totalFees = (contract.ejariFee || 0) + (contract.municipalityFee || 0) + (contract.commissionFee || 0)

  // Tenant block (English)
  const tenantBlockEn = tenant.isCompany
    ? `
      <div><span class="k">Company:</span> <strong>${esc(tenant.companyName || tenant.name)}</strong></div>
      <div><span class="k">Trade License:</span> ${esc(tenant.companyTradeLicense || '—')}</div>
      <div><span class="k">License Expiry:</span> ${esc(tenant.companyTradeLicenseExpiry || '—')}</div>
      <div><span class="k">Signatory:</span> ${esc(tenant.signatoryName || tenant.name)}</div>
      <div><span class="k">Title:</span> ${esc(tenant.signatoryTitle || '—')}</div>
      <div><span class="k">Contact:</span> ${esc(tenant.phone)} / ${esc(tenant.email)}</div>`
    : `
      <div><span class="k">Name:</span> <strong>${esc(tenant.name)}</strong></div>
      <div><span class="k">Emirates ID:</span> ${esc(tenant.emiratesId || '—')}</div>
      <div><span class="k">Passport No.:</span> ${esc(tenant.passportNo || '—')}</div>
      <div><span class="k">Nationality:</span> ${esc(tenant.nationality || '—')}</div>
      <div><span class="k">Visa No.:</span> ${esc(tenant.visaNo || '—')}</div>
      <div><span class="k">Occupation:</span> ${esc(tenant.occupation || '—')}</div>
      <div><span class="k">Employer:</span> ${esc(tenant.employer || '—')}</div>
      <div><span class="k">Family Size:</span> ${esc(tenant.familySize || 1)}</div>
      <div><span class="k">Phone:</span> ${esc(tenant.phone)}</div>
      <div><span class="k">Email:</span> ${esc(tenant.email)}</div>`

  const tenantBlockAr = tenant.isCompany
    ? `
      <div><span class="k">الشركة:</span> <strong>${esc(tenant.companyName || tenant.name)}</strong></div>
      <div><span class="k">الرخصة التجارية:</span> ${esc(tenant.companyTradeLicense || '—')}</div>
      <div><span class="k">انتهاء الرخصة:</span> ${esc(tenant.companyTradeLicenseExpiry || '—')}</div>
      <div><span class="k">المفوض بالتوقيع:</span> ${esc(tenant.signatoryName || tenant.name)}</div>
      <div><span class="k">المنصب:</span> ${esc(tenant.signatoryTitle || '—')}</div>
      <div><span class="k">الاتصال:</span> ${esc(tenant.phone)} / ${esc(tenant.email)}</div>`
    : `
      <div><span class="k">الاسم:</span> <strong>${esc(tenant.name)}</strong></div>
      <div><span class="k">الهوية الإماراتية:</span> ${esc(tenant.emiratesId || '—')}</div>
      <div><span class="k">رقم الجواز:</span> ${esc(tenant.passportNo || '—')}</div>
      <div><span class="k">الجنسية:</span> ${esc(tenant.nationality || '—')}</div>
      <div><span class="k">رقم التأشيرة:</span> ${esc(tenant.visaNo || '—')}</div>
      <div><span class="k">المهنة:</span> ${esc(tenant.occupation || '—')}</div>
      <div><span class="k">جهة العمل:</span> ${esc(tenant.employer || '—')}</div>
      <div><span class="k">عدد الأسرة:</span> ${esc(tenant.familySize || 1)}</div>
      <div><span class="k">الهاتف:</span> ${esc(tenant.phone)}</div>
      <div><span class="k">البريد:</span> ${esc(tenant.email)}</div>`

  const clausesRows = CLAUSES.map(
    (c, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td class="en">${esc(c.en)}</td>
        <td class="ar" dir="rtl" lang="ar">${esc(c.ar)}</td>
      </tr>`
  ).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Tenancy Contract – ${esc(contract.contractNo)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet" />
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #1a1a1a; }
  body {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 10.5pt;
    line-height: 1.5;
    padding: 22px 30px;
  }
  .ar { font-family: 'Cairo', 'Tahoma', sans-serif; direction: rtl; text-align: right; }

  .doc-header {
    text-align: center;
    border-bottom: 3px double #E30613;
    padding-bottom: 14px;
    margin-bottom: 18px;
  }
  .doc-header img { height: 70px; margin-bottom: 6px; }
  .doc-header h1 {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 22pt;
    margin: 4px 0 0;
    color: #E30613;
    letter-spacing: 1px;
  }
  .doc-header h1.ar {
    font-family: 'Cairo', sans-serif;
    font-size: 20pt;
    margin: 2px 0 4px;
  }
  .doc-header .sub { font-size: 10.5pt; color: #555; font-style: italic; }
  .meta {
    display: flex;
    justify-content: space-between;
    font-size: 9.5pt;
    color: #444;
    margin-bottom: 14px;
  }

  h2 {
    font-family: 'Playfair Display', Georgia, serif;
    color: #E30613;
    font-size: 13pt;
    border-bottom: 1.5px solid #E30613;
    padding-bottom: 3px;
    margin: 18px 0 10px;
  }
  h2 .ar-title {
    float: right;
    font-family: 'Cairo', sans-serif;
    font-size: 13pt;
  }

  .bilingual {
    display: table;
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    margin: 8px 0;
  }
  .bilingual > .col {
    display: table-cell;
    width: 50%;
    vertical-align: top;
    padding: 8px 12px;
    border: 1px solid #e3d4d6;
    background: #fffafa;
    font-size: 10pt;
  }
  .bilingual > .col.ar {
    direction: rtl;
    text-align: right;
    font-family: 'Cairo', sans-serif;
  }
  .bilingual h3 { margin: 0 0 6px 0; color: #E30613; font-size: 11pt; }
  .kv { font-size: 10pt; }
  .kv div { margin: 2px 0; }
  .kv .k { color: #666; display: inline-block; min-width: 110px; }
  .kv.ar .k { min-width: 130px; }

  table.data {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0;
    font-size: 10pt;
    page-break-inside: avoid;
  }
  table.data th, table.data td {
    border: 1px solid #c9d1dc;
    padding: 6px 8px;
    vertical-align: top;
  }
  table.data th {
    background: #fff5f5;
    color: #E30613;
    text-align: left;
    font-weight: 600;
  }
  table.data td.right { text-align: right; }
  table.data tr.total td { background: #fff0f0; font-weight: 700; color: #E30613; }

  table.clauses {
    width: 100%;
    border-collapse: collapse;
    margin: 6px 0;
    font-size: 9.5pt;
  }
  table.clauses th, table.clauses td {
    border: 1px solid #d6dae0;
    padding: 6px 8px;
    vertical-align: top;
  }
  table.clauses th {
    background: #fff5f5;
    color: #E30613;
    font-weight: 600;
  }
  table.clauses td.num { width: 28px; text-align: center; font-weight: 600; color: #E30613; }
  table.clauses td.en { width: 47%; }
  table.clauses td.ar {
    width: 47%;
    font-family: 'Cairo', sans-serif;
    direction: rtl;
    text-align: right;
  }
  table.clauses tr { page-break-inside: avoid; }

  .signatures { margin-top: 22px; page-break-inside: avoid; }
  .sig-row {
    display: table;
    width: 100%;
    table-layout: fixed;
    margin-top: 18px;
  }
  .sig-row > .sig-box {
    display: table-cell;
    width: 50%;
    border-top: 1px solid #333;
    padding: 8px 14px 0;
    font-size: 9.5pt;
    color: #333;
    min-height: 80px;
    vertical-align: top;
  }
  .sig-row > .sig-box.ar {
    direction: rtl;
    text-align: right;
    font-family: 'Cairo', sans-serif;
  }
  .sig-row > .sig-box .role { font-weight: 700; color: #E30613; margin-bottom: 18px; }

  .footer-note {
    margin-top: 22px;
    border-top: 2px solid #E30613;
    padding-top: 8px;
    font-size: 8.5pt;
    color: #777;
    text-align: center;
  }

  @media print {
    body { padding: 0; }
    h2 { page-break-after: avoid; }
    .signatures, .bilingual { page-break-inside: avoid; }
  }
</style>
</head>
<body>

<div class="doc-header">
  
  <h1>TENANCY CONTRACT</h1>
  <h1 class="ar" dir="rtl" lang="ar">عقد إيجار</h1>
  <div class="sub">Alwaan – Property Management</div>
</div>

<div class="meta">
  <div><strong>Contract No / رقم العقد:</strong> ${esc(contract.contractNo)} (v${esc(contract.version)})</div>
  <div><strong>Date Issued / تاريخ الإصدار:</strong> ${today}</div>
</div>

<h2>1. Parties <span class="ar-title" dir="rtl" lang="ar">١. الأطراف</span></h2>
<div class="bilingual">
  <div class="col">
    <h3>Landlord</h3>
    <div class="kv">
      <div><span class="k">Name:</span> <strong>${esc(owner?.ownerName || '—')}</strong></div>
      <div><span class="k">Type:</span> ${esc(owner?.ownerType || 'Individual')}</div>
      <div><span class="k">Emirates ID:</span> ${esc(owner?.emiratesId || '—')}</div>
      <div><span class="k">Nationality:</span> ${esc(owner?.nationality || '—')}</div>
      <div><span class="k">Phone:</span> ${esc(owner?.phone || '—')}</div>
      <div><span class="k">Email:</span> ${esc(owner?.email || '—')}</div>
    </div>
    <h3 style="margin-top:8px;">Property Manager</h3>
    <div class="kv">
      <div><span class="k">Acting on behalf of the Landlord:</span></div>
      <div><strong>Alwaan L.L.C.</strong></div>
      <div>Dubai, United Arab Emirates</div>
    </div>
    <h3 style="margin-top:8px;">Tenant</h3>
    <div class="kv">${tenantBlockEn}</div>
  </div>
  <div class="col ar" dir="rtl" lang="ar">
    <h3>المالك</h3>
    <div class="kv ar">
      <div><span class="k">الاسم:</span> <strong>${esc(owner?.ownerName || '—')}</strong></div>
      <div><span class="k">النوع:</span> ${esc(owner?.ownerType || 'فرد')}</div>
      <div><span class="k">الهوية الإماراتية:</span> ${esc(owner?.emiratesId || '—')}</div>
      <div><span class="k">الجنسية:</span> ${esc(owner?.nationality || '—')}</div>
      <div><span class="k">الهاتف:</span> ${esc(owner?.phone || '—')}</div>
      <div><span class="k">البريد:</span> ${esc(owner?.email || '—')}</div>
    </div>
    <h3 style="margin-top:8px;">إدارة العقار</h3>
    <div class="kv ar">
      <div><span class="k">بالنيابة عن المالك:</span></div>
      <div><strong>كونتيننتال للعقارات</strong></div>
      <div>دبي، الإمارات العربية المتحدة</div>
    </div>
    <h3 style="margin-top:8px;">المستأجر</h3>
    <div class="kv ar">${tenantBlockAr}</div>
  </div>
</div>

<h2>2. Property <span class="ar-title" dir="rtl" lang="ar">٢. العقار</span></h2>
<div class="bilingual">
  <div class="col">
    <div class="kv">
      <div><span class="k">Building:</span> <strong>${esc(owner?.buildingName || '—')}</strong></div>
      <div><span class="k">Unit No.:</span> ${esc(unit.unitNo)}</div>
      <div><span class="k">Unit Type:</span> ${esc(unit.unitType || '—')}</div>
      <div><span class="k">Emirate / Area:</span> ${esc(owner?.emirate || '—')} / ${esc(owner?.area || '—')}</div>
      <div><span class="k">Plot No.:</span> ${esc(owner?.plotNo || '—')}</div>
      <div><span class="k">Makani No.:</span> ${esc(owner?.makaniNo || '—')}</div>
      <div><span class="k">Title Deed:</span> ${esc(owner?.titleDeedNo || '—')}</div>
      <div><span class="k">Purpose:</span> ${esc(contract.purpose || contract.contractType)}</div>
    </div>
  </div>
  <div class="col ar" dir="rtl" lang="ar">
    <div class="kv ar">
      <div><span class="k">المبنى:</span> <strong>${esc(owner?.buildingName || '—')}</strong></div>
      <div><span class="k">رقم الوحدة:</span> ${esc(unit.unitNo)}</div>
      <div><span class="k">نوع الوحدة:</span> ${esc(unit.unitType || '—')}</div>
      <div><span class="k">الإمارة / المنطقة:</span> ${esc(owner?.emirate || '—')} / ${esc(owner?.area || '—')}</div>
      <div><span class="k">رقم القطعة:</span> ${esc(owner?.plotNo || '—')}</div>
      <div><span class="k">رقم مكاني:</span> ${esc(owner?.makaniNo || '—')}</div>
      <div><span class="k">شهادة الملكية:</span> ${esc(owner?.titleDeedNo || '—')}</div>
      <div><span class="k">الغرض:</span> ${esc(contract.purpose || contract.contractType)}</div>
    </div>
  </div>
</div>

<h2>3. Lease Terms <span class="ar-title" dir="rtl" lang="ar">٣. شروط الإيجار</span></h2>
<div class="bilingual">
  <div class="col">
    <div class="kv">
      <div><span class="k">Start Date:</span> <strong>${startDate}</strong></div>
      <div><span class="k">End Date:</span> <strong>${endDate}</strong></div>
      <div><span class="k">Commencement:</span> ${startDate}</div>
      <div><span class="k">Annual Rent:</span> <strong>${formatCurrency(contract.rentAmount)}</strong></div>
      <div><span class="k">Rent in Words:</span> ${esc(contract.rentInWords || '—')}</div>
      <div><span class="k">Number of Cheques:</span> ${esc(contract.numberOfCheques)}</div>
      <div><span class="k">Security Deposit:</span> ${formatCurrency(contract.securityDeposit)} (${isResidential ? '5% Residential' : '10% Commercial'})</div>
      <div><span class="k">Booking Amount:</span> ${formatCurrency(contract.bookingAmount)} (non-refundable)</div>
      <div><span class="k">Grace Period:</span> ${isResidential ? '20 days (Residential)' : '30 days (Commercial)'} – until ${graceDate}</div>
    </div>
  </div>
  <div class="col ar" dir="rtl" lang="ar">
    <div class="kv ar">
      <div><span class="k">تاريخ البدء:</span> <strong>${startDate}</strong></div>
      <div><span class="k">تاريخ الانتهاء:</span> <strong>${endDate}</strong></div>
      <div><span class="k">تاريخ السريان:</span> ${startDate}</div>
      <div><span class="k">قيمة الإيجار السنوي:</span> <strong>${formatCurrency(contract.rentAmount)}</strong></div>
      <div><span class="k">الإيجار كتابةً:</span> ${esc(contract.rentInWords || '—')}</div>
      <div><span class="k">عدد الشيكات:</span> ${esc(contract.numberOfCheques)}</div>
      <div><span class="k">التأمين:</span> ${formatCurrency(contract.securityDeposit)} (${isResidential ? '٥٪ سكني' : '١٠٪ تجاري'})</div>
      <div><span class="k">مبلغ الحجز:</span> ${formatCurrency(contract.bookingAmount)} (غير قابل للاسترداد)</div>
      <div><span class="k">فترة السماح:</span> ${isResidential ? '٢٠ يوم (سكني)' : '٣٠ يوم (تجاري)'} – حتى ${graceDate}</div>
    </div>
  </div>
</div>

<h2>4. Fees Collected <span class="ar-title" dir="rtl" lang="ar">٤. الرسوم المحصلة</span></h2>
<table class="data">
  <thead>
    <tr>
      <th>Description / الوصف</th>
      <th class="right">Amount AED / المبلغ</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>EJARI Registration / <span dir="rtl" lang="ar">تسجيل إيجاري</span></td><td class="right">${formatCurrency(contract.ejariFee)}</td></tr>
    <tr><td>Municipality Service / <span dir="rtl" lang="ar">رسوم البلدية</span></td><td class="right">${formatCurrency(contract.municipalityFee)}</td></tr>
    <tr><td>Commission ${isResidential ? '(Residential 5%)' : '(Commercial 10%, min AED 1,050)'} / <span dir="rtl" lang="ar">العمولة</span></td><td class="right">${formatCurrency(contract.commissionFee)}</td></tr>
    <tr class="total"><td>Total / <span dir="rtl" lang="ar">الإجمالي</span></td><td class="right">${formatCurrency(totalFees)}</td></tr>
  </tbody>
</table>

<h2>5. Tenant Obligations &amp; Addendum Clauses <span class="ar-title" dir="rtl" lang="ar">٥. التزامات المستأجر</span></h2>
<table class="clauses">
  <thead>
    <tr>
      <th class="num">#</th>
      <th>English</th>
      <th class="ar" dir="rtl" lang="ar">العربية</th>
    </tr>
  </thead>
  <tbody>
    ${clausesRows}
  </tbody>
</table>

<h2>6. Signatures <span class="ar-title" dir="rtl" lang="ar">٦. التوقيعات</span></h2>
<div class="signatures">
  <div class="sig-row">
    <div class="sig-box">
      <div class="role">TENANT</div>
      Name: ${esc(tenant.isCompany ? tenant.signatoryName || tenant.name : tenant.name)}<br/>
      Emirates ID: ${esc(tenant.emiratesId || '__________')}<br/>
      Date: __________<br/>
      Signature: __________
    </div>
    <div class="sig-box ar" dir="rtl" lang="ar">
      <div class="role">المستأجر</div>
      الاسم: ${esc(tenant.isCompany ? tenant.signatoryName || tenant.name : tenant.name)}<br/>
      الهوية الإماراتية: ${esc(tenant.emiratesId || '__________')}<br/>
      التاريخ: __________<br/>
      التوقيع: __________
    </div>
  </div>
  <div class="sig-row">
    <div class="sig-box">
      <div class="role">LANDLORD / MANAGEMENT</div>
      Name: ${esc(owner?.ownerName || '__________')}<br/>
      For: Alwaan<br/>
      Date: __________<br/>
      Signature: __________
    </div>
    <div class="sig-box ar" dir="rtl" lang="ar">
      <div class="role">المالك / الإدارة</div>
      الاسم: ${esc(owner?.ownerName || '__________')}<br/>
      نيابةً عن: كونتيننتال للعقارات<br/>
      التاريخ: __________<br/>
      التوقيع: __________
    </div>
  </div>
  <div class="sig-row">
    <div class="sig-box">
      <div class="role">WITNESS 1</div>
      Name: __________<br/>
      Emirates ID: __________<br/>
      Signature: __________
    </div>
    <div class="sig-box ar" dir="rtl" lang="ar">
      <div class="role">الشاهد ١</div>
      الاسم: __________<br/>
      الهوية الإماراتية: __________<br/>
      التوقيع: __________
    </div>
  </div>
  <div class="sig-row">
    <div class="sig-box">
      <div class="role">WITNESS 2</div>
      Name: __________<br/>
      Emirates ID: __________<br/>
      Signature: __________
    </div>
    <div class="sig-box ar" dir="rtl" lang="ar">
      <div class="role">الشاهد ٢</div>
      الاسم: __________<br/>
      الهوية الإماراتية: __________<br/>
      التوقيع: __________
    </div>
  </div>
</div>

<div class="footer-note">
  Alwaan &middot; Dubai, UAE &middot; Governed by UAE Federal Law and Dubai Real Estate Law No. 26 of 2007<br/>
  Contract Ref: ${esc(contract.contractNo)} v${esc(contract.version)} &middot; Generated ${today}
</div>

</body>
</html>`
}
