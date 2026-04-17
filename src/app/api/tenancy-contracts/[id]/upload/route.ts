import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { createNotification } from '@/lib/notifications'
import path from 'path'
import { mkdir, writeFile } from 'fs/promises'

export const runtime = 'nodejs'

const MAX_BYTES = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
])
const ALLOWED_EXT = new Set(['.pdf', '.jpg', '.jpeg', '.png'])

function safeExt(name: string, mime: string): string | null {
  const lower = name.toLowerCase()
  const idx = lower.lastIndexOf('.')
  let ext = idx >= 0 ? lower.slice(idx) : ''
  if (!ext) {
    if (mime === 'application/pdf') ext = '.pdf'
    else if (mime === 'image/png') ext = '.png'
    else if (mime === 'image/jpeg' || mime === 'image/jpg') ext = '.jpg'
  }
  if (!ALLOWED_EXT.has(ext)) return null
  return ext
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const organizationId = session.user.organizationId
    const { id } = await params

    const contract = await prisma.tenancyContract.findFirst({
      where: { id, organizationId },
      include: { tenant: true },
    })
    if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 })

    const form = await request.formData()
    const file = form.get('file')
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Missing "file" field' }, { status: 400 })
    }
    if (file.size <= 0) return NextResponse.json({ error: 'Empty file' }, { status: 400 })
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File exceeds 10MB limit' }, { status: 400 })
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 400 })
    }
    const ext = safeExt(file.name || '', file.type)
    if (!ext) return NextResponse.json({ error: 'Unsupported file extension' }, { status: 400 })

    const uploadsRoot = path.join(process.cwd(), 'uploads', 'tenancy-contracts', contract.tenantId)
    await mkdir(uploadsRoot, { recursive: true })

    const timestamp = Date.now()
    const safeContractNo = contract.contractNo.replace(/[^A-Za-z0-9_-]/g, '_')
    const filename = `${safeContractNo}_signed_${timestamp}${ext}`
    const fullPath = path.join(uploadsRoot, filename)

    const bytes = Buffer.from(await file.arrayBuffer())
    await writeFile(fullPath, bytes)

    const now = new Date()

    // Mark previous active contracts for same tenant+unit as Renewed
    await prisma.tenancyContract.updateMany({
      where: {
        organizationId,
        tenantId: contract.tenantId,
        unitId: contract.unitId,
        status: 'Active',
        id: { not: id },
      },
      data: { status: 'Renewed' },
    })

    const updated = await prisma.tenancyContract.update({
      where: { id },
      data: {
        signedFilePath: fullPath,
        signedFileName: filename,
        signedFileSize: bytes.length,
        uploadedAt: now,
        status: 'Active',
        signedByTenantAt: contract.signedByTenantAt || now,
        signedByLandlordAt: contract.signedByLandlordAt || now,
        effectiveAt: contract.effectiveAt || now,
      },
    })

    await logActivity(
      organizationId,
      session.user.name,
      'Uploaded Signed Tenancy Contract',
      `${contract.contractNo} v${contract.version} – ${filename} (${bytes.length} bytes)`
    )
    await createNotification(
      organizationId,
      'staff',
      '',
      'Signed Tenancy Contract Uploaded',
      `${contract.contractNo} signed copy uploaded for ${contract.tenant.name}`,
      'system'
    )

    const { htmlBody: _o, ...safe } = updated
    return NextResponse.json({ message: 'Signed copy uploaded', contract: safe })
  } catch (error) {
    console.error('POST /api/tenancy-contracts/[id]/upload error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
