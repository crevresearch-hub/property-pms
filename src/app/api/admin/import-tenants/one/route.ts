import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { parseEjari } from '@/lib/ejari-parser'
import { normalizeUnitType } from '@/lib/unit-type-mapper'
import { readFile, readdir } from 'fs/promises'
import path from 'path'
import { PDFParse } from 'pdf-parse'
import { saveFile } from '@/lib/storage'

async function extractPdfText(buf: Buffer): Promise<string> {
  try {
    const parser = new PDFParse({ data: buf })
    const out = await parser.getText()
    return out.text || ''
  } catch (e) {
    console.error('pdf-parse failed', e)
    return ''
  }
}

export const maxDuration = 120

interface ImportBody {
  folderPath: string
  unitNo: string
  tenantNameFromFolder: string
  skipIfUnitHasTenant?: boolean
}

async function findPdf(dir: string): Promise<string | null> {
  const list = await readdir(dir).catch(() => [] as string[])
  const pdf = list.find((n) => n.toLowerCase().endsWith('.pdf'))
  return pdf ? path.join(dir, pdf) : null
}

async function copyPdfAsDocument(
  organizationId: string,
  tenantId: string,
  srcPath: string,
  docType: string
) {
  const buf = await readFile(srcPath)
  const originalFilename = path.basename(srcPath)
  const timestamp = Date.now()
  const safeName = originalFilename
    .replace(/\.pdf$/i, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .substring(0, 50)
  const filename = `${timestamp}_${safeName}.pdf`

  const saved = await saveFile(buf, tenantId, filename, 'application/pdf')

  await prisma.tenantDocument.create({
    data: {
      organizationId,
      tenantId,
      docType,
      filename,
      originalFilename,
      filePath: saved.filePath,
      fileSize: saved.size,
      status: 'Uploaded',
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const organizationId = session.user.organizationId
    const body = (await request.json()) as ImportBody
    const { folderPath, unitNo, tenantNameFromFolder, skipIfUnitHasTenant = true } = body

    if (!folderPath || !unitNo) {
      return NextResponse.json({ error: 'folderPath and unitNo are required' }, { status: 400 })
    }

    const unit = await prisma.unit.findUnique({
      where: { organizationId_unitNo: { organizationId, unitNo } },
      include: { tenant: true },
    })

    if (!unit) {
      return NextResponse.json({ status: 'skipped', reason: `Unit ${unitNo} not found in DB` })
    }

    if (skipIfUnitHasTenant && unit.tenantId) {
      return NextResponse.json({
        status: 'skipped',
        reason: `Unit ${unitNo} already has tenant: ${unit.tenant?.name}`,
      })
    }

    // Locate PDFs
    const eidDir = path.join(folderPath, 'emirates_id')
    const ejariDir = path.join(folderPath, 'ejari')
    const chequesDir = path.join(folderPath, 'cheques')

    const [eidPdf, ejariPdf, chequesPdf] = await Promise.all([
      findPdf(eidDir),
      findPdf(ejariDir),
      findPdf(chequesDir),
    ])


    // Extract Ejari text directly from PDF (Ejari PDFs are generated with text layer — no OCR needed)
    let ejariData: ReturnType<typeof parseEjari> | null = null
    let ejariStatus: 'success' | 'failed' | 'skipped' = 'skipped'

    if (ejariPdf) {
      try {
        const buf = await readFile(ejariPdf)
        const text = await extractPdfText(buf)
        if (text && text.length > 200) {
          ejariData = parseEjari(text)
          ejariStatus = 'success'
        } else {
          ejariStatus = 'failed'
        }
      } catch (e) {
        console.error('Ejari extract failed for', ejariPdf, e)
        ejariStatus = 'failed'
      }
    }

    // All data comes from Ejari only
    const finalName = ejariData?.tenantName || tenantNameFromFolder
    const finalEid = ejariData?.emiratesId || ''
    const finalNationality = ejariData?.nationality || ''
    const finalPhone = ejariData?.mobileNo || ''
    const finalPassport = ejariData?.passportNo || ''

    // Create tenant
    const tenant = await prisma.tenant.create({
      data: {
        organizationId,
        name: finalName,
        phone: finalPhone,
        emiratesId: finalEid,
        passportNo: finalPassport,
        nationality: finalNationality,
        notes: [
          ejariData?.passportExpiry && `Passport Expiry: ${ejariData.passportExpiry}`,
          ejariData?.visaNo && `Visa No: ${ejariData.visaNo}`,
          ejariData?.visaExpiry && `Visa Expiry: ${ejariData.visaExpiry}`,
          ejariData?.tenantNo && `Ejari Tenant No: ${ejariData.tenantNo}`,
          ejariStatus === 'failed' && 'Ejari text extraction failed - manual review needed',
        ].filter(Boolean).join('\n'),
      },
    })

    // Link tenant to unit + fill contract/property data from Ejari
    const unitUpdate: Record<string, unknown> = { tenantId: tenant.id, status: 'Occupied' }
    if (ejariData) {
      if (ejariData.startDate) unitUpdate.contractStart = ejariData.startDate
      if (ejariData.endDate) unitUpdate.contractEnd = ejariData.endDate
      if (ejariData.annualAmount) unitUpdate.currentRent = ejariData.annualAmount
      if (ejariData.sizeSqft) unitUpdate.sqFt = ejariData.sizeSqft
      if (ejariData.propertySubType || ejariData.propertyType) {
        const raw = (ejariData.propertySubType || ejariData.propertyType).trim()
        unitUpdate.unitType = normalizeUnitType(raw) || raw
      }
      const unitNotes = [
        ejariData.contractNo && `Ejari Contract No: ${ejariData.contractNo}`,
        ejariData.propertyNo && `Ejari Property No: ${ejariData.propertyNo}`,
        ejariData.buildingName && `Building: ${ejariData.buildingName}`,
        ejariData.plotNumber && `Plot No: ${ejariData.plotNumber}`,
        ejariData.landDmNo && `Land DM No: ${ejariData.landDmNo}`,
        ejariData.makaniNo && `Makani No: ${ejariData.makaniNo}`,
        ejariData.dewaPremiseNo && `DEWA Premise No: ${ejariData.dewaPremiseNo}`,
        ejariData.usage && `Usage: ${ejariData.usage}`,
        ejariData.securityDeposit && `Security Deposit: AED ${ejariData.securityDeposit}`,
        ejariData.graceStart && `Grace Start: ${ejariData.graceStart}`,
        ejariData.graceEnd && `Grace End: ${ejariData.graceEnd}`,
        ejariData.ownerName && `Owner: ${ejariData.ownerName}`,
        ejariData.ownerNumber && `Owner No: ${ejariData.ownerNumber}`,
      ].filter(Boolean).join('\n')
      if (unitNotes) unitUpdate.notes = unitNotes
    }
    await prisma.unit.update({ where: { id: unit.id }, data: unitUpdate })

    // Copy PDFs as TenantDocuments
    const uploadResults: string[] = []
    if (eidPdf) {
      await copyPdfAsDocument(organizationId, tenant.id, eidPdf, 'Emirates ID').catch((e) => {
        console.error('EID copy failed', e)
      })
      uploadResults.push('EID')
    }
    if (ejariPdf) {
      await copyPdfAsDocument(organizationId, tenant.id, ejariPdf, 'Ejari').catch((e) => {
        console.error('Ejari copy failed', e)
      })
      uploadResults.push('Ejari')
    }
    if (chequesPdf) {
      await copyPdfAsDocument(organizationId, tenant.id, chequesPdf, 'Cheques').catch((e) => {
        console.error('Cheques copy failed', e)
      })
      uploadResults.push('Cheques')
    }

    await logActivity(
      organizationId,
      session.user.name,
      'Bulk-Imported Tenant',
      `Unit ${unitNo} → ${finalName} (Ejari: ${ejariStatus}, docs: ${uploadResults.join(', ') || 'none'})`
    )

    return NextResponse.json({
      status: 'created',
      tenantId: tenant.id,
      tenantName: finalName,
      unitNo,
      ejariStatus,
      documentsUploaded: uploadResults,
      ejariData,
    })
  } catch (error) {
    console.error('POST /api/admin/import-tenants/one error:', error)
    return NextResponse.json(
      { status: 'error', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
