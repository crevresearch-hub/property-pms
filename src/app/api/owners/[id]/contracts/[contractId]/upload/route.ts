import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { createNotification } from '@/lib/notifications'
import { sendEmail } from '@/lib/email'
import { contractSignedTemplate } from '@/lib/email-templates'
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
  { params }: { params: Promise<{ id: string; contractId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    const { id, contractId } = await params

    const contract = await prisma.ownerContract.findFirst({
      where: { id: contractId, ownerId: id, organizationId },
      include: { owner: true },
    })
    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    const form = await request.formData()
    const file = form.get('file')
    const signedByOwnerNameRaw = form.get('signedByOwnerName')
    const signedByOwnerName =
      typeof signedByOwnerNameRaw === 'string' && signedByOwnerNameRaw.trim()
        ? signedByOwnerNameRaw.trim()
        : contract.owner.ownerName

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Missing "file" field' }, { status: 400 })
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: 'Empty file' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File exceeds 10MB limit' }, { status: 400 })
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 400 })
    }
    const ext = safeExt(file.name || '', file.type)
    if (!ext) {
      return NextResponse.json({ error: 'Unsupported file extension' }, { status: 400 })
    }

    const uploadsRoot = path.join(process.cwd(), 'uploads', 'contracts', id)
    await mkdir(uploadsRoot, { recursive: true })

    const timestamp = Date.now()
    const safeContractNo = contract.contractNo.replace(/[^A-Za-z0-9_-]/g, '_')
    const filename = `${safeContractNo}_signed_${timestamp}${ext}`
    const fullPath = path.join(uploadsRoot, filename)

    const bytes = Buffer.from(await file.arrayBuffer())
    await writeFile(fullPath, bytes)

    const now = new Date()

    // Auto-supersede ALL other contracts for this owner (Draft/Sent/Signed/Active),
    // leaving only this uploaded version as Active.
    await prisma.ownerContract.updateMany({
      where: {
        organizationId,
        ownerId: id,
        id: { not: contractId },
        status: { in: ['Draft', 'Sent', 'Signed', 'Active'] },
      },
      data: { status: 'Superseded', supersededById: contractId },
    })

    const updated = await prisma.ownerContract.update({
      where: { id: contractId },
      data: {
        signedFilePath: fullPath,
        signedFileName: filename,
        signedFileSize: bytes.length,
        uploadedAt: now,
        status: 'Active',
        signedAt: contract.signedAt || now,
        signedByOwnerName: contract.signedByOwnerName || signedByOwnerName,
        signedByCREName: contract.signedByCREName || session.user.name || '',
      },
    })

    await prisma.propertyOwner.update({
      where: { id },
      data: {
        signedByOwner: true,
        signedByCRE: true,
        contractSignedAt: now,
        stage: 'Contract Signed',
        contractDocPath: fullPath,
      },
    })

    await logActivity(
      organizationId,
      session.user.name,
      'Uploaded Signed PM Contract',
      `${contract.contractNo} v${contract.version} – ${filename} (${bytes.length} bytes)`
    )

    await createNotification(
      organizationId,
      'staff',
      '',
      'Signed Contract Uploaded',
      `${contract.contractNo} signed copy uploaded for ${contract.owner.ownerName}`,
      'system'
    )

    // Email the owner a confirmation that the final signed agreement is on file
    if (contract.owner.email) {
      try {
        const baseUrl = process.env.NEXTAUTH_URL || ''
        const tpl = contractSignedTemplate(contract.owner as never, updated as never, baseUrl)
        await sendEmail({
          organizationId,
          to: contract.owner.email,
          toName: contract.owner.ownerName,
          subject: tpl.subject,
          html: tpl.html,
          template: 'contract_signed',
          triggeredBy: session.user.name,
          refType: 'owner',
          refId: contract.owner.id,
        })
      } catch (e) {
        console.error('Failed to send signed confirmation email:', e)
      }
    }

    const { htmlBody: _o, ...safe } = updated
    return NextResponse.json({ message: 'Signed copy uploaded', contract: safe })
  } catch (error) {
    console.error('POST /api/owners/[id]/contracts/[contractId]/upload error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
