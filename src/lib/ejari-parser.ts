export interface EjariParseResult {
  // Property block
  propertyNo: string
  propertyType: string
  propertySubType: string
  usage: string
  sizeSqm: number
  sizeSqft: number
  dewaPremiseNo: string
  buildingName: string
  plotNumber: string
  landDmNo: string
  makaniNo: string

  // Tenant block
  tenantName: string
  tenantNameAr: string
  tenantNo: string
  nationality: string
  passportNo: string
  passportExpiry: string
  emiratesId: string
  visaNo: string
  visaExpiry: string
  mobileNo: string

  // Owner
  ownerName: string
  ownerNumber: string

  // Contract block
  contractNo: string
  startDate: string
  endDate: string
  graceStart: string
  graceEnd: string
  discount: number
  securityDeposit: number
  contractAmount: number
  annualAmount: number
  actualContractAmount: number
  actualAnnualAmount: number
}

function stripNonAscii(s: string): string {
  // PDF-extracted Arabic text from Ejari often lands in Greek/weird Unicode ranges due to font mapping.
  // Keep only ASCII printable + common whitespace/tabs — reliable for field extraction.
  return s.replace(/[^\x20-\x7E\t\n]+/g, ' ').replace(/[ ]{2,}/g, ' ')
}

function parseAmount(s: string | undefined): number {
  if (!s) return 0
  const n = parseFloat(s.replace(/,/g, ''))
  return isNaN(n) ? 0 : n
}

function parseDmy(s: string | undefined): string {
  if (!s) return ''
  const m = s.match(/(\d{2})-(\d{2})-(\d{4})/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}

/** Grab AED amount. `direction` tells whether the value comes before or after the label. */
function grabAmount(text: string, label: string, direction: 'before' | 'after'): number {
  const rx = direction === 'before'
    ? new RegExp(`([\\d,]+(?:\\.\\d+)?)\\s*AED\\s+${label}`, 'i')
    : new RegExp(`${label}\\s+([\\d,]+(?:\\.\\d+)?)\\s*AED`, 'i')
  return parseAmount(text.match(rx)?.[1])
}

/** Grab dd-mm-yyyy date. */
function grabDate(text: string, label: string, direction: 'before' | 'after'): string {
  const rx = direction === 'before'
    ? new RegExp(`(\\d{2}-\\d{2}-\\d{4})\\s+${label}`, 'i')
    : new RegExp(`${label}\\s+(\\d{2}-\\d{2}-\\d{4})`, 'i')
  return parseDmy(text.match(rx)?.[1])
}

export function parseEjari(rawText: string): EjariParseResult {
  const textRaw = rawText || ''
  const text = stripNonAscii(textRaw)

  const result: EjariParseResult = {
    propertyNo: '', propertyType: '', propertySubType: '', usage: '',
    sizeSqm: 0, sizeSqft: 0, dewaPremiseNo: '',
    buildingName: '', plotNumber: '', landDmNo: '', makaniNo: '',
    tenantName: '', tenantNameAr: '', tenantNo: '', nationality: '',
    passportNo: '', passportExpiry: '', emiratesId: '',
    visaNo: '', visaExpiry: '', mobileNo: '',
    ownerName: '', ownerNumber: '',
    contractNo: '',
    startDate: '', endDate: '', graceStart: '', graceEnd: '',
    discount: 0, securityDeposit: 0,
    contractAmount: 0, annualAmount: 0,
    actualContractAmount: 0, actualAnnualAmount: 0,
  }

  // --- Property row ---
  // Format: <PropertyNo> <Type> <SubType words> <Usage> <Size> (Sq.m) <DEWA>
  const propRow = text.match(
    /(\d{2,6})\s+(Flat|Villa|Shop|Office|Apartment|Studio|Warehouse|Commercial|Building|Room|Labour\s+Camp)\s+(.+?)\s+(Residential|Commercial|Industrial)\s+([\d.]+)\s*\(?\s*Sq\.?\s*m\s*\)?\s+(\d{6,12})/i
  )
  if (propRow) {
    result.propertyNo = propRow[1]
    result.propertyType = propRow[2]
    result.propertySubType = propRow[3].trim()
    result.usage = propRow[4]
    result.sizeSqm = parseFloat(propRow[5])
    result.sizeSqft = Math.round(result.sizeSqm * 10.7639)
    result.dewaPremiseNo = propRow[6]
  } else {
    const sizeM = text.match(/([\d.]+)\s*\(?\s*Sq\.?\s*m\s*\)?/i)
    if (sizeM) {
      result.sizeSqm = parseFloat(sizeM[1])
      result.sizeSqft = Math.round(result.sizeSqm * 10.7639)
    }
    const usageM = text.match(/\b(Residential|Commercial|Industrial)\b/i)
    if (usageM) result.usage = usageM[1]
    const dewaM = text.match(/DEWA[^0-9]{0,40}(\d{6,12})/i)
    if (dewaM) result.dewaPremiseNo = dewaM[1]
  }

  // Building / Plot / DM No / Makani
  const bldM = text.match(/Building\s+Name\/?No\.?\s+([A-Z][A-Z0-9 '.\-]{2,60})/i)
  if (bldM) result.buildingName = bldM[1].trim()
  const plotM = text.match(/Plot\s+Number[^\d]{0,40}(\d{2,6}-\d{2,6}|\d{2,6})/i)
  if (plotM) result.plotNumber = plotM[1]
  const dmM = text.match(/Land\s+DM\s+No[^\d]{0,40}(\d{2,10}-\d{2,10}|\d{2,10})/i)
  if (dmM) result.landDmNo = dmM[1]
  const makM = text.match(/Makani\s+No[^\d]{0,40}(\d{5,15})/i)
  if (makM) result.makaniNo = makM[1]

  // --- Tenant block ---
  const nameM = text.match(/Tenant\s+Name\s+([A-Z][A-Z'.\- ]{2,80})/)
  if (nameM) result.tenantName = nameM[1].replace(/\s+/g, ' ').trim()

  // Tenant No: 10-18 digits right after "Tenant No"
  const tNoM = text.match(/Tenant\s+No\s+(\d{10,18})/i)
  if (tNoM) result.tenantNo = tNoM[1]

  // Nationality: country name between a tab and the "Nationality" label
  const natM = text.match(/[\s\t]([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3})[\s\t]+Nationality\b/)
  if (natM) result.nationality = natM[1].trim()

  // Emirates ID: 15 consecutive digits anywhere (tenant EID starts with 784)
  const eidM = text.match(/\b(784\d{12})\b/) || text.match(/\b(\d{15})\b/)
  if (eidM) {
    const raw = eidM[1]
    result.emiratesId = `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7, 14)}-${raw.slice(14)}`
  }

  // Passport: starts with letter (sometimes letter at end too), then date
  const passM = text.match(/\b([A-Z][A-Z0-9]{5,12})\s*\/\s*(\d{2}-\d{2}-\d{4})\b/)
  if (passM) {
    result.passportNo = passM[1]
    result.passportExpiry = parseDmy(passM[2])
  }

  // Visa: 13-16 digits / date (distinguished from passport by absence of leading letter)
  const visaM = text.match(/\b(\d{13,16})\s*\/\s*(\d{2}-\d{2}-\d{4})\b/)
  if (visaM) {
    result.visaNo = visaM[1]
    result.visaExpiry = parseDmy(visaM[2])
  }

  // Mobile No (UAE): 00971 / +971 / 05...
  const mobM = text.match(/\b(?:00971|\+?971|0)(5\d)\s*\d{7}\b/) || text.match(/\b(?:00971|\+?971)\d{8,10}\b/)
  if (mobM) {
    result.mobileNo = mobM[0].replace(/\s+/g, '')
  }

  // --- Owner ---
  const ownerNameM = text.match(/Owner\s+Name\s+([A-Z][A-Z'.\- ]{3,80})/)
  if (ownerNameM) result.ownerName = ownerNameM[1].trim().replace(/\s+/g, ' ')
  const ownerNoM = text.match(/Owner\s+Number\s+(\d{3,15})/)
  if (ownerNoM) result.ownerNumber = ownerNoM[1]

  // --- Contract / Dates / Amounts ---
  const contractNoM = text.match(/Contract\s+No:?\s*(\d{10,20})/i) || text.match(/(\d{16})\s*\(v\.\s*\d+\)/)
  if (contractNoM) result.contractNo = contractNoM[1]

  result.startDate = grabDate(text, 'Start\\s+Date', 'after')
  result.endDate = grabDate(text, 'End\\s+Date', 'before')
  result.graceStart = grabDate(text, 'Grace\\s+Start\\s+Date', 'after')
  result.graceEnd = grabDate(text, 'Grace\\s+End\\s+Date', 'before')

  result.discount = grabAmount(text, 'Discount', 'after')
  result.contractAmount = grabAmount(text, 'Contract\\s+Amount', 'after')
  result.actualContractAmount = grabAmount(text, 'Actual\\s+Contract\\s+Amount', 'after')
  result.securityDeposit = grabAmount(text, 'Security\\s+Deposit', 'before')
  result.annualAmount = grabAmount(text, 'Annual\\s+Amount', 'before')
  result.actualAnnualAmount = grabAmount(text, 'Actual\\s+Annual\\s+Amount', 'before')

  return result
}
