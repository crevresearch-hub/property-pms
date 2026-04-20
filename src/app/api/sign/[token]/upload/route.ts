import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import prisma from '@/lib/prisma'
import { createNotification } from '@/lib/notifications'
import { parseEid, runOcrSpace } from '@/lib/eid-parser'
import { buildDldTenancyContractHTML } from '@/lib/dld-tenancy-contract-builder'

/**
 * POST /api/sign/[token]/upload
 *
 * Public (unauthenticated) multipart upload used by the tenant sign page
 * to attach an *optional* Emirates ID copy alongside their electronic
 * signature. The token is the TenancyContract.signatureToken and acts
 * as the bearer credential.
 *
 * Saves the file to:
 *   uploads/sign-tenant-eid/{contractId}/eid-{timestamp}.{ext}
 *
 * Also creates a TenantDocument row (docType="Emirates ID",
 * status="Uploaded") so Alwaan can verify / re-upload it from the
 * tenant edit page before activation.
 */

export const runtime = 'nodejs'

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
])
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

function extFromMime(mime: string): string {
  switch (mime.toLowerCase()) {
    case 'application/pdf':
      return 'pdf'
    case 'image/png':
      return 'png'
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg'
    case 'image/webp':
      return 'webp'
    default:
      return 'bin'
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    const tc = await prisma.tenancyContract.findFirst({
      where: { signatureToken: token },
    })
    if (!tc) {
      return NextResponse.json(
        { error: 'Invalid or expired signature link' },
        { status: 404 }
      )
    }

    if (!['Draft', 'Sent'].includes(tc.status) && !tc.signedByTenantAt) {
      return NextResponse.json(
        {
          error: `This contract is no longer accepting attachments (status: ${tc.status}).`,
        },
        { status: 410 }
      )
    }

    const form = await request.formData().catch(() => null)
    if (!form) {
      return NextResponse.json(
        { error: 'Expected multipart/form-data body.' },
        { status: 400 }
      )
    }

    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'No file uploaded (expected form field "file").' },
        { status: 400 }
      )
    }

    const mime = (file.type || '').toLowerCase()
    if (!ALLOWED_MIMES.has(mime)) {
      return NextResponse.json(
        { error: 'Only PDF, JPG, PNG or WebP files are allowed.' },
        { status: 400 }
      )
    }
    if (file.size === 0) {
      return NextResponse.json({ error: 'File is empty.' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: 'File must be 5 MB or smaller.' },
        { status: 413 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = extFromMime(mime)
    const timestamp = Date.now()
    const sideRaw = String(form.get('side') || '').toLowerCase()
    const side = sideRaw === 'back' ? 'back' : sideRaw === 'front' ? 'front' : ''
    const filename = `eid-${side || 'side'}-${timestamp}.${ext}`

    const uploadDir = path.join(
      process.cwd(),
      'uploads',
      'sign-tenant-eid',
      tc.id
    )
    await mkdir(uploadDir, { recursive: true }).catch(() => {})
    const fullPath = path.join(uploadDir, filename)
    await writeFile(fullPath, buffer).catch(() => {})

    const relPath = `uploads/sign-tenant-eid/${tc.id}/${filename}`

    const doc = await prisma.tenantDocument.create({
      data: {
        organizationId: tc.organizationId,
        tenantId: tc.tenantId,
        docType: side === 'back' ? 'Emirates ID (Back)' : 'Emirates ID',
        filename,
        originalFilename: file.name || `Emirates ID ${side || ''} (self-uploaded).${ext}`,
        filePath: relPath,
        fileSize: buffer.length,
        status: 'Uploaded',
        reviewNotes: `Uploaded by tenant via public sign page (${side || 'unspecified side'})`,
      },
    })

    // Fire-and-forget: run OCR + contract rebuild in the background so the
    // tenant's submit returns immediately. The PM portal will show the
    // auto-filled fields once OCR finishes (typically within 30-60s).
    const apiKey = process.env.OCR_SPACE_API_KEY
    if (apiKey && mime.startsWith('image/')) {
      ;(async () => {
        try {
          const [engText, araText] = await Promise.all([
            runOcrSpace(buffer, mime, filename, apiKey, 'eng'),
            runOcrSpace(buffer, mime, filename, apiKey, 'ara'),
          ])
          console.log(`[eid-ocr] side=${side} engLen=${engText.length} araLen=${araText.length}`)
          if (engText.length > 0) {
            console.log(`[eid-ocr] first 400 chars (eng):`, engText.slice(0, 400).replace(/\s+/g, ' '))
          }
          const parsed = parseEid(engText, araText)
          console.log(`[eid-ocr] parsed:`, JSON.stringify(parsed))
          const updates: Record<string, unknown> = {}
          if (parsed.nameEn) {
            updates.eidNameEn = parsed.nameEn
            updates.name = parsed.nameEn
          }
          if (parsed.nameAr) updates.eidNameAr = parsed.nameAr
          if (parsed.eidNumber) {
            updates.eidNumber = parsed.eidNumber
            updates.emiratesId = parsed.eidNumber
          }
          if (parsed.dob) updates.eidDob = parsed.dob
          if (parsed.expiry) {
            updates.eidExpiry = parsed.expiry
            updates.emiratesIdExpiry = parsed.expiry
          }
          if (parsed.nationality) updates.nationality = parsed.nationality
          if (parsed.occupation) updates.occupation = parsed.occupation
          if (parsed.employer) updates.employer = parsed.employer
          if (Object.keys(updates).length === 0) return

          updates.eidVerifiedAt = new Date().toISOString()
          updates.eidVerifiedBy = 'tenant (self-upload)'
          await prisma.tenant.update({ where: { id: tc.tenantId }, data: updates })

          // Rebuild contract HTML with the real identity filled in.
          const tenant = await prisma.tenant.findUnique({ where: { id: tc.tenantId } })
          const fresh = await prisma.tenancyContract.findUnique({ where: { id: tc.id } })
          if (!tenant || !fresh) return
          const unit = await prisma.unit.findUnique({ where: { id: fresh.unitId } })
          if (!unit) return
          const owner = fresh.ownerId
            ? await prisma.propertyOwner.findUnique({ where: { id: fresh.ownerId } })
            : null

          const sigMatch = (fresh.htmlBody || '').match(/<img[^>]+src="(data:image\/png;base64,[^"]+)"[^>]*alt="Signed"/)
          const signatureImage = sigMatch ? sigMatch[1] : ''

          const baseUrl = process.env.NEXTAUTH_URL || ''
          let newHtml = buildDldTenancyContractHTML({
            tenant: {
              name: tenant.name,
              email: tenant.email,
              phone: tenant.phone,
              emiratesId: tenant.emiratesId,
              occupants: tenant.familySize,
              isCompany: tenant.isCompany,
              companyName: tenant.companyName,
              companyTradeLicense: tenant.companyTradeLicense,
            },
            unit: {
              unitNo: unit.unitNo,
              unitType: unit.unitType,
              currentRent: fresh.rentAmount,
              contractStart: fresh.contractStart,
              contractEnd: fresh.contractEnd,
            },
            owner: {
              ownerName: owner?.ownerName || '',
              buildingName: owner?.buildingName || '',
              area: owner?.area || '',
              plotNo: owner?.plotNo || '',
              makaniNo: owner?.makaniNo || '',
              dewaPremiseNo: '',
            },
            contractValue: fresh.rentAmount,
            securityDeposit: fresh.securityDeposit,
            numCheques: fresh.numberOfCheques,
            date: new Date().toISOString().slice(0, 10),
          }, baseUrl)

          if (signatureImage) {
            const dateStr = fresh.signedByTenantAt
              ? new Date(fresh.signedByTenantAt).toLocaleDateString('en-GB')
              : ''
            const safeName = tenant.name.replace(/[<>]/g, '')
            const sigImg = `<img src="${signatureImage}" alt="Signed" style="max-height:46px;display:block;margin:4px 0 2px 0;"/>`
            const tenantBoxRe = /(<div class="label">Tenant Signature \/ توقيع المستأجر<\/div>)\s*<div class="line">([^<]*<span>[^<]*<\/span>)<span>Date: ____________<\/span><\/div>/g
            newHtml = newHtml.replace(tenantBoxRe, (_m, label) => {
              return `${label}
                <div style="min-height:50px;padding:2px 0;">${sigImg}</div>
                <div class="line"><span>${safeName}</span><span>Date: ${dateStr}</span></div>`
            })
          }

          await prisma.tenancyContract.update({
            where: { id: tc.id },
            data: { htmlBody: newHtml },
          })
          console.log(`[eid-ocr] ${side}: tenant + contract updated successfully`)
        } catch (e) {
          console.warn('[eid-ocr] background processing failed for', side, ':', e)
        }
      })()
    }

    const noteLine = `Tenant uploaded Emirates ID (${side || 'side'}) (${file.name || filename}, ${buffer.length} bytes) → ${relPath}`
    await prisma.tenancyContract.update({
      where: { id: tc.id },
      data: {
        notes: [tc.notes || '', noteLine].filter(Boolean).join('\n'),
      },
    })

    await createNotification(
      tc.organizationId,
      'staff',
      '',
      'Tenant Uploaded Emirates ID',
      `Tenant uploaded Emirates ID with tenancy contract ${tc.contractNo}. Please verify.`,
      'system'
    )

    return NextResponse.json({
      ok: true,
      documentId: doc.id,
      filename: doc.filename,
      size: doc.fileSize,
    })
  } catch (error) {
    console.error('POST /api/sign/[token]/upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
