/**
 * Normalize free-form unit type strings (from Ejari / import / manual entry)
 * into the canonical set used across the app:
 *   Studio, 1 BHK, 2 BHK, 3 BHK, 4 BHK, Penthouse, Shop, Office, Commercial, Warehouse
 */
export function normalizeUnitType(raw: string | null | undefined): string {
  if (!raw) return ''
  const s = raw.toString().toLowerCase().trim().replace(/\s+/g, ' ')

  if (!s) return ''

  // Bedroom counts (variations: "1bed room+hall", "1 bedroom hall", "1br", "1bhk", "1 bed")
  const bhkMatch = s.match(/(\d+)\s*(?:bed(?:\s*room)?|br|bhk|bedroom)/i)
  if (bhkMatch) {
    const n = parseInt(bhkMatch[1], 10)
    if (n >= 1 && n <= 10) return `${n} BHK`
  }

  if (/\bstudio\b/i.test(s)) return 'Studio'
  if (/\bpenthouse\b/i.test(s)) return 'Penthouse'
  if (/\bshop\b/i.test(s)) return 'Shop'
  if (/\boffice\b/i.test(s)) return 'Office'
  if (/\bwarehouse\b/i.test(s)) return 'Warehouse'
  if (/\blabou?r\s*camp\b/i.test(s)) return 'Labour Camp'
  if (/\bvilla\b/i.test(s)) return 'Villa'
  if (/\bbuilding\b/i.test(s)) return 'Building'
  if (/\bcommercial\b/i.test(s)) return 'Commercial'

  // Fallback: if it already matches our canonical format like "1 BHK", title-case it
  if (/^\d+\s*bhk$/i.test(s)) {
    const n = s.match(/\d+/)![0]
    return `${n} BHK`
  }

  return raw
}
