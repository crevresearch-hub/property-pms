const natMap: Record<string, string> = {
  ARE: 'Emirati', SDN: 'Sudanese', IND: 'Indian', PAK: 'Pakistani',
  EGY: 'Egyptian', PHL: 'Filipino', LBN: 'Lebanese', SYR: 'Syrian',
  JOR: 'Jordanian', GBR: 'British', USA: 'American', BGD: 'Bangladeshi',
  NPL: 'Nepali', LKA: 'Sri Lankan', IRN: 'Iranian', IRQ: 'Iraqi',
  YEM: 'Yemeni', SAU: 'Saudi', KWT: 'Kuwaiti', OMN: 'Omani', BHR: 'Bahraini',
  QAT: 'Qatari', MAR: 'Moroccan', TUN: 'Tunisian', DZA: 'Algerian',
  PSE: 'Palestinian', ETH: 'Ethiopian', KEN: 'Kenyan', NGA: 'Nigerian',
  CHN: 'Chinese', RUS: 'Russian', UKR: 'Ukrainian', FRA: 'French',
  DEU: 'German', ITA: 'Italian', ESP: 'Spanish', TUR: 'Turkish',
  AFG: 'Afghan', IDN: 'Indonesian', MYS: 'Malaysian', THA: 'Thai',
}

export interface EidParseResult {
  nameEn: string
  nameAr: string
  eidNumber: string
  nationality: string
  dob: string
  expiry: string
  occupation: string
  employer: string
}

export function parseEid(engText: string, araText = ''): EidParseResult {
  const text = engText || ''

  const eidMatch = text.match(/784[-\s]?\d{4}[-\s]?\d{7}[-\s]?\d/)
  const eidNumber = eidMatch ? eidMatch[0].replace(/\s/g, '-') : ''

  const rawLines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ''))
  const mrzLines = rawLines.filter((l) => /^[A-Z0-9<]{25,}$/.test(l) && l.includes('<'))

  let mrzDob = '', mrzExpiry = '', mrzNat = '', mrzName = ''
  for (const l of mrzLines) {
    const m2 = l.match(/^(\d{6})\d([MF])(\d{6})\d([A-Z]{3})/)
    if (m2) {
      const toIso = (s: string) => {
        const yy = parseInt(s.slice(0, 2), 10)
        const yyyy = yy < 50 ? 2000 + yy : 1900 + yy
        return `${yyyy}-${s.slice(2, 4)}-${s.slice(4, 6)}`
      }
      mrzDob = toIso(m2[1])
      mrzExpiry = toIso(m2[3])
      mrzNat = m2[4]
    }
    const m3 = l.match(/^([A-Z]+)<<([A-Z<]+)$/)
    if (m3) {
      const surname = m3[1].replace(/</g, ' ').trim()
      const given = m3[2].replace(/</g, ' ').trim()
      mrzName = `${given} ${surname}`.replace(/\s+/g, ' ').trim()
    }
  }

  const expiryLabel = text.match(/Expir[yi][^\d]{0,30}(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})/i)
  const dobLabel = text.match(/Birth[^\d]{0,30}(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})/i)
  const nameLabel = text.match(/Name[:\s]+([A-Z][A-Za-z\s]{2,60})/)
  const natLabel = text.match(/Nationality[:\s]+([A-Za-z]+)/i)

  const today = new Date().toISOString().slice(0, 10)
  const allDates = [...text.matchAll(/(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})/g)]
    .map((m) => `${m[3]}-${m[2]}-${m[1]}`)
    .filter((d) => !isNaN(new Date(d).getTime()))
  const uniq = [...new Set(allDates)].sort()

  const expiry =
    mrzExpiry ||
    (expiryLabel ? `${expiryLabel[3]}-${expiryLabel[2]}-${expiryLabel[1]}` : '') ||
    uniq.filter((d) => d > today).pop() ||
    ''
  const dob =
    mrzDob ||
    (dobLabel ? `${dobLabel[3]}-${dobLabel[2]}-${dobLabel[1]}` : '') ||
    uniq.filter((d) => d < today && d !== expiry)[0] ||
    ''

  let nameEn = mrzName
  if (!nameEn && nameLabel) nameEn = nameLabel[1].trim().split('\n')[0]

  const nationality = (mrzNat && natMap[mrzNat]) || mrzNat || (natLabel?.[1] ?? '')

  // Arabic name
  const jobKeywords = [
    'العمل', 'الوظيفة', 'صاحب', 'المهنة', 'جهة', 'العنوان',
    'الإمارة', 'الإمارات', 'دبي', 'أبوظبي', 'الشارقة', 'عجمان',
    'رأس', 'الخيمة', 'أم', 'القيوين', 'الفجيرة',
  ]
  const araLines = (araText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /[\u0600-\u06FF]/.test(l))
  let nameAr = ''
  for (let i = 0; i < araLines.length; i++) {
    if (/الاسم/.test(araLines[i])) {
      const same = araLines[i].replace(/^.*الاسم[:\s]*/, '').trim()
      if (same && same.length >= 4) { nameAr = same; break }
      if (araLines[i + 1]) { nameAr = araLines[i + 1]; break }
    }
  }
  if (!nameAr) {
    nameAr =
      araLines.find(
        (l) =>
          l.length >= 6 &&
          l.length <= 80 &&
          !jobKeywords.some((k) => l.includes(k)) &&
          !/\d/.test(l)
      ) || ''
  }

  // Occupation + Employer (printed on the back of the EID)
  const occMatch = text.match(/Occupation[:\s]+([A-Z][A-Za-z &.\-]{2,60})/i)
  const empMatch = text.match(/Employer[:\s]+([A-Z][A-Za-z0-9 &.\-,()]{2,80})/i)
  const occupation = occMatch ? occMatch[1].trim().split('\n')[0].trim() : ''
  const employer = empMatch ? empMatch[1].trim().split('\n')[0].trim() : ''

  return { nameEn, nameAr, eidNumber, nationality, dob, expiry, occupation, employer }
}

/**
 * Resize a large image down for the OCR.space free tier, which times out
 * on images over ~500 KB. Target: max 1400px wide JPEG at 80% quality.
 * Non-images (PDF) and already-small images pass through unchanged.
 */
async function prepareForOcr(buf: Buffer, mime: string): Promise<{ buf: Buffer; mime: string }> {
  if (!mime.startsWith('image/')) return { buf, mime }
  if (buf.length < 400 * 1024) return { buf, mime }
  try {
    const sharp = (await import('sharp')).default
    const out = await sharp(buf)
      .resize({ width: 1400, withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer()
    return { buf: out, mime: 'image/jpeg' }
  } catch (e) {
    console.warn('[eid-ocr] sharp resize failed, sending original:', e)
    return { buf, mime }
  }
}

export async function runOcrSpace(
  buf: Buffer,
  mime: string,
  fileName: string,
  apiKey: string,
  language: 'eng' | 'ara'
): Promise<string> {
  const prepped = await prepareForOcr(buf, mime)
  const outName =
    fileName.replace(/\.[^.]+$/, '') +
    (prepped.mime === 'image/jpeg' ? '.jpg' : fileName.match(/\.[^.]+$/)?.[0] || '')

  const attempt = async (): Promise<{ text: string; timedOut: boolean }> => {
    const fd = new FormData()
    fd.append('file', new Blob([new Uint8Array(prepped.buf)], { type: prepped.mime }), outName)
    fd.append('apikey', apiKey)
    fd.append('OCREngine', language === 'ara' ? '1' : '2')
    fd.append('scale', 'true')
    fd.append('isTable', 'false')
    fd.append('detectOrientation', 'true')
    fd.append('language', language)
    const r = await fetch('https://api.ocr.space/parse/image', { method: 'POST', body: fd })
    if (!r.ok) return { text: '', timedOut: false }
    const j = await r.json()
    const msg = JSON.stringify(j.ErrorMessage || '')
    if (j.IsErroredOnProcessing) {
      const timedOut = /Timed out/i.test(msg)
      if (!timedOut) console.warn('[eid-ocr] OCR.space error:', msg)
      return { text: '', timedOut }
    }
    return { text: (j.ParsedResults?.[0]?.ParsedText || '') as string, timedOut: false }
  }

  // OCR.space free tier intermittently times out. Retry up to 3x on timeout.
  for (let i = 0; i < 3; i++) {
    const { text, timedOut } = await attempt()
    if (text) return text
    if (!timedOut) return ''
    console.warn(`[eid-ocr] timeout (attempt ${i + 1}/3, lang=${language}) — retrying`)
    await new Promise((r) => setTimeout(r, 800))
  }
  return ''
}
