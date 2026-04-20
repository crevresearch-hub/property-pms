/**
 * Default editable content for the Property Management Agreement.
 * Every string here is user-editable via the Full Contract Editor UI.
 * When an owner has custom content saved in PropertyOwner.contractClausesJson,
 * it overrides these defaults when generating a new contract version.
 */

export interface ContractContent {
  preambleEn: string
  preambleAr: string
  serviceTypeARMap: Record<string, string>
  services: Array<{ en: string; ar: string }>
  fees: Array<{
    serviceEn: string
    serviceAr: string
    amount: string
    remarksEn: string
    remarksAr: string
    beneficiary: string
  }>
  feesFooterEn: string
  feesFooterAr: string
  ownerObligations: Array<{ en: string; ar: string }>
  creObligations: Array<{ en: string; ar: string }>
  paymentToOwner: Array<{ en: string; ar: string }>
  reports: Array<{ en: string; ar: string; freq: string }>
  kpis: Array<{ labelEn: string; labelAr: string; target: string }>
  termination: Array<{ en: string; ar: string }>
  confidentiality: Array<{ en: string; ar: string }>
  disputeResolution: Array<{ en: string; ar: string }>
  governingLaw: Array<{ en: string; ar: string }>
  footerNoteEn: string
  footerNoteAr: string
  sectionHeaders: {
    s1En: string; s1Ar: string
    s2En: string; s2Ar: string
    s3En: string; s3Ar: string
    s4En: string; s4Ar: string
    s5En: string; s5Ar: string
    s6En: string; s6Ar: string
    s7En: string; s7Ar: string
    s8En: string; s8Ar: string
    s9En: string; s9Ar: string
    s10En: string; s10Ar: string
    s11En: string; s11Ar: string
    s12En: string; s12Ar: string
    s13En: string; s13Ar: string
    s14En: string; s14Ar: string
    s15En: string; s15Ar: string
  }
}

export function getDefaultContractContent(): ContractContent {
  return {
    preambleEn:
      'This Property Management Agreement ("Agreement") is entered into by and between the Owner and Alwaan L.L.C., as the appointed Property Management Company, on the date stated above. Both parties acknowledge that they have read, understood, and agreed to all the terms and conditions set forth herein and in any schedules attached.',
    preambleAr:
      'تم إبرام اتفاقية إدارة العقار هذه ("الاتفاقية") بين المالك وشركة ألوان ذ.م.م. بصفتها شركة إدارة العقار المعينة، في التاريخ المذكور أعلاه. يقر الطرفان بأنهما قد قرآ وفهما وافقا على جميع الشروط والأحكام الواردة في هذه الاتفاقية وفي أي ملاحق مرفقة بها.',

    serviceTypeARMap: {
      'Full Property Management': 'إدارة العقار الكاملة',
      'Leasing Only / Brokerage': 'التأجير فقط / الوساطة',
      'Rent Collection Only': 'تحصيل الإيجارات فقط',
      'Maintenance Only': 'الصيانة فقط',
      'Hybrid (Custom)': 'مختلط (مخصص)',
      'Sales Brokerage': 'وساطة البيع',
      'Snagging Service': 'خدمة فحص العيوب',
    },

    services: [
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
    ],

    fees: [
      { serviceEn: 'New Lease Commission (Residential)', serviceAr: 'عمولة عقد إيجار جديد (سكني)', amount: '5% of annual rent (or AED 1,050 min, VAT inclusive)', remarksEn: 'For each new lease concluded', remarksAr: 'لكل عقد إيجار جديد يتم إبرامه', beneficiary: 'Alwaan' },
      { serviceEn: 'New Lease Commission (Commercial)', serviceAr: 'عمولة عقد إيجار جديد (تجاري)', amount: '10% of annual rent (or AED 1,050 min, VAT inclusive)', remarksEn: 'For each new lease concluded', remarksAr: 'لكل عقد إيجار جديد يتم إبرامه', beneficiary: 'Alwaan' },
      { serviceEn: 'Renewal Fee (Residential)', serviceAr: 'رسوم تجديد العقد (سكني)', amount: 'AED 850 (VAT inclusive)', remarksEn: 'For each tenancy renewal', remarksAr: 'لكل تجديد عقد إيجار', beneficiary: 'Alwaan' },
      { serviceEn: 'Renewal Fee (Commercial)', serviceAr: 'رسوم تجديد العقد (تجاري)', amount: 'AED 1,500 (VAT inclusive)', remarksEn: 'For each tenancy renewal', remarksAr: 'لكل تجديد عقد إيجار', beneficiary: 'Alwaan' },
      { serviceEn: 'EJARI Registration', serviceAr: 'تسجيل إيجاري', amount: 'AED 250 (VAT inclusive)', remarksEn: 'For Dubai properties only', remarksAr: 'للعقارات في إمارة دبي فقط', beneficiary: 'Alwaan' },
      { serviceEn: 'Municipality Service Charge', serviceAr: 'رسوم خدمة البلدية', amount: 'AED 210 (VAT inclusive)', remarksEn: 'For lease registration on Municipality system', remarksAr: 'لتسجيل العقد في نظام البلدية', beneficiary: 'Alwaan' },
      { serviceEn: 'Cheque Replacement', serviceAr: 'استبدال الشيك', amount: 'AED 262.50 (VAT inclusive)', remarksEn: 'Per replacement after receipt issuance', remarksAr: 'لكل استبدال بعد إصدار الإيصال', beneficiary: 'Alwaan' },
      { serviceEn: 'Cheque Postponement', serviceAr: 'تأجيل الشيك', amount: 'AED 262.50 (VAT inclusive)', remarksEn: 'Max 1 month from original date', remarksAr: 'بحد أقصى شهر من التاريخ الأصلي', beneficiary: 'Alwaan' },
      { serviceEn: 'Returned/Bounced Cheque', serviceAr: 'الشيك المرتجع', amount: 'AED 525 (VAT inclusive)', remarksEn: 'For each cheque returned by bank', remarksAr: 'لكل شيك يرتجع من البنك', beneficiary: 'Alwaan' },
      { serviceEn: 'Late Renewal (within 15 days)', serviceAr: 'تأخير التجديد (خلال 15 يوم)', amount: 'AED 525 (VAT inclusive)', remarksEn: 'Renewal within 15 days of expiry', remarksAr: 'تجديد خلال 15 يوم من انتهاء العقد', beneficiary: 'Alwaan' },
      { serviceEn: 'Late Renewal (within 30 days)', serviceAr: 'تأخير التجديد (خلال 30 يوم)', amount: 'AED 1,050 (VAT inclusive)', remarksEn: 'Renewal within 30 days of expiry', remarksAr: 'تجديد خلال 30 يوم من انتهاء العقد', beneficiary: 'Alwaan' },
      { serviceEn: 'Name Change / Lease Transfer (Residential)', serviceAr: 'تغيير الاسم / نقل العقد (سكني)', amount: '5% of annual rent', remarksEn: 'Changing lessor during lease period', remarksAr: 'تغيير المستأجر خلال فترة العقد', beneficiary: 'Alwaan' },
      { serviceEn: 'Name Change / Lease Transfer (Commercial)', serviceAr: 'تغيير الاسم / نقل العقد (تجاري)', amount: '10% of annual rent', remarksEn: 'Changing lessor during lease period', remarksAr: 'تغيير المستأجر خلال فترة العقد', beneficiary: 'Alwaan' },
      { serviceEn: 'Certification Letters', serviceAr: 'رسائل التصديق', amount: 'AED 100', remarksEn: 'Per certification requested by tenant', remarksAr: 'لكل تصديق يطلبه المستأجر', beneficiary: 'Alwaan' },
      { serviceEn: 'Early Termination (Residential)', serviceAr: 'الإنهاء المبكر (سكني)', amount: '2 months annual rent', remarksEn: 'Breaking lease during contract period', remarksAr: 'فسخ العقد خلال فترة التعاقد', beneficiary: 'Landlord' },
      { serviceEn: 'Early Termination (Commercial)', serviceAr: 'الإنهاء المبكر (تجاري)', amount: '3 months annual rent', remarksEn: 'Breaking lease during contract period', remarksAr: 'فسخ العقد خلال فترة التعاقد', beneficiary: 'Landlord' },
    ],

    feesFooterEn:
      'All Alwaan-collected fees are inclusive of UAE VAT (5%). Late fees, bounced cheque fines, and replacement fees collected from tenants are retained by Alwaan as compensation for handling and follow-up. Early termination penalties go to the Landlord as compensation for lost rental income.',
    feesFooterAr:
      'جميع الرسوم التي تحصلها Alwaan شاملة لضريبة القيمة المضافة 5%. الغرامات المتأخرة، رسوم الشيكات المرتجعة، ورسوم الاستبدال التي تحصل من المستأجرين تحتفظ بها Alwaan كتعويض عن المعالجة والمتابعة. غرامات الإنهاء المبكر تذهب للمالك كتعويض عن فقدان الدخل الإيجاري.',

    ownerObligations: [
      { en: 'Provide a clear and valid copy of the title deed and proof of ownership of the building.', ar: 'تقديم نسخة سارية وواضحة من سند الملكية وما يثبت ملكية المبنى.' },
      { en: 'Pay all building-related service charges (chiller, A/C central system, fire & life safety, common area maintenance, etc.).', ar: 'دفع جميع رسوم خدمات المبنى (التبريد، نظام التكييف المركزي، أنظمة الحريق والسلامة، صيانة المناطق المشتركة).' },
      { en: 'Maintain a valid building insurance policy covering structure and third-party liability.', ar: 'الاحتفاظ بوثيقة تأمين سارية تغطي هيكل المبنى والمسؤولية تجاه الغير.' },
      { en: 'Approve in writing any major repair or capital expenditure exceeding the agreed approval threshold.', ar: 'الموافقة كتابياً على أي إصلاحات كبيرة أو نفقات رأسمالية تتجاوز سقف الموافقة المتفق عليه.' },
      { en: 'Provide Alwaan with a Power of Attorney or written authorization to act on behalf of the Owner for EJARI registration, legal cases, and government dealings as required.', ar: 'تزويد Alwaan بتوكيل أو تفويض كتابي للتصرف نيابة عن المالك في تسجيل إيجاري، القضايا القانونية، والتعاملات الحكومية.' },
      { en: 'Provide unit/building access for inspections, viewings, and maintenance work.', ar: 'توفير إمكانية الوصول إلى الوحدات/المبنى للفحص والمعاينة وأعمال الصيانة.' },
      { en: 'Settle any outstanding utility bills, fees, or fines existing prior to the handover date.', ar: 'تسوية أي فواتير خدمات أو رسوم أو غرامات معلقة قبل تاريخ التسليم.' },
      { en: 'Notify Alwaan in writing of any changes to ownership, banking details, or contact information.', ar: 'إخطار Alwaan كتابياً بأي تغييرات في الملكية، البيانات المصرفية، أو معلومات الاتصال.' },
      { en: 'Refrain from communicating directly with tenants regarding lease matters during the term of this Agreement; all such communications shall be channeled through Alwaan.', ar: 'الامتناع عن التواصل المباشر مع المستأجرين بشأن أمور الإيجار خلال مدة هذه الاتفاقية؛ تتم جميع الاتصالات عبر Alwaan.' },
    ],

    creObligations: [
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
    ],

    paymentToOwner: [
      { en: '<strong>Frequency:</strong> {{paymentFrequency}} ({{paymentFrequencyDesc}})', ar: '<strong>التكرار:</strong> {{paymentFrequencyArDesc}}' },
      { en: '<strong>Method:</strong> Bank transfer to Owner\'s designated IBAN account.', ar: '<strong>الطريقة:</strong> تحويل مصرفي إلى حساب IBAN المخصص للمالك.' },
      { en: '<strong>Statement:</strong> Itemized statement of rent collected, expenses incurred, Alwaan commission deducted, and net amount payable to Owner.', ar: '<strong>البيان:</strong> بيان مفصل للإيجارات المحصلة، المصروفات المتكبدة، عمولة Alwaan المخصومة، والمبلغ الصافي المستحق للمالك.' },
      { en: '<strong>Payment Date:</strong> By the 10th day of the following payment cycle.', ar: '<strong>تاريخ الدفع:</strong> بحلول اليوم العاشر من دورة الدفع التالية.' },
      { en: '<strong>Approval Threshold:</strong> Owner approval required for any single repair or expense exceeding AED {{approvalThreshold}}.', ar: '<strong>سقف الموافقة:</strong> تتطلب موافقة المالك لأي إصلاح أو مصروف فردي يتجاوز {{approvalThreshold}} درهم.' },
    ],

    reports: [
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
    ],

    kpis: [
      { labelEn: 'Occupancy Rate', labelAr: 'معدل الإشغال', target: '≥ 90% maintained year-round / ≥ 90% طوال العام' },
      { labelEn: 'Renewal Process Initiation', labelAr: 'بدء عملية التجديد', target: '90 days before contract expiry / قبل 90 يوماً من انتهاء العقد' },
      { labelEn: 'Customer Satisfaction (CSAT)', labelAr: 'رضا العملاء', target: 'Score 8+ out of 10 / 8+ من 10' },
      { labelEn: 'Cheque Deposit Time', labelAr: 'وقت إيداع الشيك', target: 'Same business day / في نفس يوم العمل' },
      { labelEn: 'Bounced Cheque Follow-up', labelAr: 'متابعة الشيك المرتجع', target: 'Within 48 hours / خلال 48 ساعة' },
      { labelEn: 'Maintenance Resolution', labelAr: 'حل مشاكل الصيانة', target: 'Urgent: 72 hours / Non-urgent: 5 days' },
      { labelEn: 'Complaint Resolution', labelAr: 'حل الشكاوى', target: 'Within 5 working days / خلال 5 أيام عمل' },
      { labelEn: 'Legal Escalation Timing', labelAr: 'توقيت التصعيد القانوني', target: 'Within 30 days from default / خلال 30 يوماً من التقصير' },
    ],

    termination: [
      { en: '<strong>Notice:</strong> Either party may terminate this Agreement by giving {{noticePeriodDays}} days written notice to the other party.', ar: '<strong>الإشعار:</strong> يجوز لأي من الطرفين إنهاء هذه الاتفاقية بإشعار كتابي مدته {{noticePeriodDays}} يوماً للطرف الآخر.' },
      { en: '<strong>Outstanding Settlement:</strong> Upon termination, all outstanding fees, dues, and commissions must be settled within 30 days.', ar: '<strong>التسوية المعلقة:</strong> عند الإنهاء، يجب تسوية جميع الرسوم والمستحقات والعمولات المعلقة خلال 30 يوماً.' },
      { en: '<strong>File Handover:</strong> Alwaan shall hand over all tenant files, documents, keys, and PMS data within 14 days of termination effective date.', ar: '<strong>تسليم الملفات:</strong> تقوم Alwaan بتسليم جميع ملفات المستأجرين، الوثائق، المفاتيح، وبيانات نظام الإدارة خلال 14 يوماً من تاريخ سريان الإنهاء.' },
      { en: '<strong>Tenant Communication:</strong> Alwaan shall notify all existing tenants in writing of the management transition.', ar: '<strong>التواصل مع المستأجرين:</strong> تخطر Alwaan جميع المستأجرين الحاليين كتابياً بانتقال الإدارة.' },
      { en: '<strong>Continuing Obligations:</strong> Alwaan shall remain entitled to commissions on leases concluded during the term, even if such commissions become payable after termination.', ar: '<strong>الالتزامات المستمرة:</strong> تظل Alwaan مستحقة للعمولات على عقود الإيجار المبرمة خلال مدة الاتفاقية، حتى لو أصبحت هذه العمولات مستحقة بعد الإنهاء.' },
    ],

    confidentiality: [
      { en: 'Both parties agree to maintain strict confidentiality of all information exchanged under this Agreement, including but not limited to financial records, tenant personal information, and Owner banking details.', ar: 'يتفق الطرفان على الحفاظ على السرية التامة لجميع المعلومات المتبادلة بموجب هذه الاتفاقية، بما في ذلك على سبيل المثال لا الحصر السجلات المالية والمعلومات الشخصية للمستأجرين والبيانات المصرفية للمالك.' },
      { en: 'Alwaan shall comply with the UAE Personal Data Protection Law (Federal Decree-Law No. 45 of 2021) and shall implement appropriate technical and organizational measures to protect personal data.', ar: 'تلتزم Alwaan بقانون حماية البيانات الشخصية لدولة الإمارات (المرسوم بقانون اتحادي رقم 45 لسنة 2021) وتطبق التدابير التقنية والتنظيمية المناسبة لحماية البيانات الشخصية.' },
      { en: 'Tenant personal data shall not be shared with third parties except as required by law, court order, or with the Owner\'s written consent.', ar: 'لا تتم مشاركة البيانات الشخصية للمستأجرين مع أطراف ثالثة إلا كما يقتضيه القانون أو أمر المحكمة أو بموافقة كتابية من المالك.' },
      { en: 'This confidentiality obligation shall survive termination of this Agreement.', ar: 'يستمر التزام السرية هذا بعد انتهاء هذه الاتفاقية.' },
    ],

    disputeResolution: [
      { en: '<strong>Step 1 — Good Faith Negotiation:</strong> Any dispute arising from this Agreement shall first be resolved through good faith negotiation between the parties within 30 days.', ar: '<strong>الخطوة الأولى — التفاوض بحسن نية:</strong> يتم حل أي نزاع ينشأ عن هذه الاتفاقية أولاً من خلال التفاوض بحسن نية بين الطرفين خلال 30 يوماً.' },
      { en: '<strong>Step 2 — RERA Mediation:</strong> If unresolved, the parties shall refer the dispute to the Dubai Real Estate Regulatory Authority (RERA) for mediation.', ar: '<strong>الخطوة الثانية — وساطة RERA:</strong> إذا لم يتم الحل، يحيل الطرفان النزاع إلى مؤسسة التنظيم العقاري في دبي (RERA) للوساطة.' },
      { en: '<strong>Step 3 — Court:</strong> If still unresolved, the matter shall be referred to the courts of Dubai, which shall have exclusive jurisdiction.', ar: '<strong>الخطوة الثالثة — المحكمة:</strong> إذا لم يتم الحل، تحال المسألة إلى محاكم دبي التي يكون لها الاختصاص الحصري.' },
    ],

    governingLaw: [
      { en: 'This Agreement shall be governed by and construed in accordance with the laws of the United Arab Emirates and specifically the Real Estate laws of the Emirate of Dubai, including:', ar: 'تخضع هذه الاتفاقية وتفسر وفقاً لقوانين دولة الإمارات العربية المتحدة وعلى وجه الخصوص قوانين العقارات لإمارة دبي، بما في ذلك:' },
      { en: '• Law No. 26 of 2007 — Regulating the Relationship between Landlords and Tenants', ar: '• القانون رقم 26 لسنة 2007 — تنظيم العلاقة بين المؤجرين والمستأجرين' },
      { en: '• Law No. 33 of 2008 — Amending Certain Provisions of Law No. 26 of 2007', ar: '• القانون رقم 33 لسنة 2008 — تعديل بعض أحكام القانون رقم 26 لسنة 2007' },
      { en: '• Federal Decree-Law No. 45 of 2021 — Personal Data Protection Law', ar: '• المرسوم بقانون اتحادي رقم 45 لسنة 2021 — قانون حماية البيانات الشخصية' },
      { en: '• Federal Law No. 8 of 2017 — Value Added Tax (VAT)', ar: '• القانون الاتحادي رقم 8 لسنة 2017 — ضريبة القيمة المضافة' },
    ],

    footerNoteEn: 'This Agreement is executed in two (2) original copies, one for each party. Each page must be initialed by both parties.',
    footerNoteAr: 'تم تنفيذ هذه الاتفاقية في نسختين أصليتين، واحدة لكل طرف. يجب التوقيع بالأحرف الأولى من كلا الطرفين على كل صفحة.',

    sectionHeaders: {
      s1En: 'PARTIES TO THE AGREEMENT', s1Ar: 'أطراف الاتفاقية',
      s2En: 'PROPERTY DETAILS', s2Ar: 'تفاصيل العقار',
      s3En: 'AGREEMENT TERM & DURATION', s3Ar: 'مدة الاتفاقية',
      s4En: 'Alwaan SCOPE OF SERVICES', s4Ar: 'نطاق خدمات Alwaan',
      s5En: 'COMMISSION & FEES STRUCTURE', s5Ar: 'هيكل العمولات والرسوم',
      s6En: 'OWNER OBLIGATIONS', s6Ar: 'التزامات المالك',
      s7En: 'Alwaan OBLIGATIONS', s7Ar: 'التزامات Alwaan',
      s8En: 'PAYMENT TO OWNER', s8Ar: 'الدفع للمالك',
      s9En: 'REPORTING OBLIGATIONS', s9Ar: 'التزامات إعداد التقارير',
      s10En: 'KEY PERFORMANCE INDICATORS', s10Ar: 'مؤشرات الأداء الرئيسية',
      s11En: 'TERMINATION OF AGREEMENT', s11Ar: 'إنهاء الاتفاقية',
      s12En: 'CONFIDENTIALITY & DATA PROTECTION', s12Ar: 'السرية وحماية البيانات',
      s13En: 'DISPUTE RESOLUTION', s13Ar: 'حل النزاعات',
      s14En: 'GOVERNING LAW', s14Ar: 'القانون الحاكم',
      s15En: 'EXECUTION & SIGNATURES', s15Ar: 'التنفيذ والتوقيعات',
    },
  }
}

/**
 * Merge partial user-saved content with defaults, so older saves
 * still render when new fields are added.
 */
export function mergeWithDefaults(partial: Partial<ContractContent> | null | undefined): ContractContent {
  const def = getDefaultContractContent()
  if (!partial) return def
  return {
    ...def,
    ...partial,
    serviceTypeARMap: { ...def.serviceTypeARMap, ...(partial.serviceTypeARMap || {}) },
    sectionHeaders: { ...def.sectionHeaders, ...(partial.sectionHeaders || {}) },
  }
}
