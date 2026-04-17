import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import path from 'path'
import { mkdir, writeFile, unlink } from 'fs/promises'

export const runtime = 'nodejs'

const MAX_BYTES = 10 * 1024 * 1024 // 10MB

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const organizationId = session.user.organizationId
    const { id } = await params

    const owner = await prisma.propertyOwner.findFirst({
      where: { id, organizationId },
    })
    if (!owner) {
      return NextResponse.json({ error: 'Owner not found' }, { status: 404 })
    }

    const form = await request.formData()
    const file = form.get('file')

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Missing "file" field' }, { status: 400 })
    }
    if (file.size <= 0) {
      return NextResponse.json({ error: 'Empty file' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File exceeds 10MB limit' }, { status: 400 })
    }

    const isPdfMime = file.type === 'application/pdf' || file.type === 'application/x-pdf'
    const lowerName = (file.name || '').toLowerCase()
    const isPdfExt = lowerName.endsWith('.pdf')
    if (!isPdfMime || !isPdfExt) {
      return NextResponse.json(
        { error: 'Only PDF files are allowed for DLD uploads' },
        { status: 400 }
      )
    }

    const uploadsRoot = path.join(process.cwd(), 'uploads', 'dld', id)
    await mkdir(uploadsRoot, { recursive: true })

    const timestamp = Date.now()
    const filename = `${timestamp}.pdf`
    const fullPath = path.join(uploadsRoot, filename)

    const bytes = Buffer.from(await file.arrayBuffer())
    await writeFile(fullPath, bytes)

    const now = new Date()
    const shouldAutoRegister =
      owner.dldStatus === 'Not Registered' || owner.dldStatus === 'In Progress'

    const updated = await prisma.propertyOwner.update({
      where: { id },
      data: {
        dldPdfPath: fullPath,
        dldPdfName: file.name || filename,
        dldPdfSize: bytes.length,
        dldPdfUploadedAt: now,
        ...(shouldAutoRegister ? { dldStatus: 'Registered' } : {}),
        ...(shouldAutoRegister && !owner.dldRegisteredAt
          ? { dldRegisteredAt: now }
          : {}),
      },
      select: {
        dldContractNo: true,
        dldStatus: true,
        dldContractType: true,
        dldSubmittedAt: true,
        dldRegisteredAt: true,
        dldPdfPath: true,
        dldPdfName: true,
        dldPdfSize: true,
        dldPdfUploadedAt: true,
        dldNotes: true,
      },
    })

    await logActivity(
      organizationId,
      session.user.name,
      'DLD PDF Uploaded',
      `${owner.ownerName} (${owner.buildingName}): ${file.name} (${bytes.length} bytes)${
        shouldAutoRegister ? ' — status set to Registered' : ''
      }`
    )

    return NextResponse.json({
      message: 'DLD PDF uploaded successfully',
      autoRegistered: shouldAutoRegister,
      dld: updated,
    })
  } catch (error) {
    console.error('POST /api/owners/[id]/dld/upload error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const organizationId = session.user.organizationId
    const { id } = await params

    const owner = await prisma.propertyOwner.findFirst({
      where: { id, organizationId },
    })
    if (!owner) {
      return NextResponse.json({ error: 'Owner not found' }, { status: 404 })
    }
    if (!owner.dldPdfPath) {
      return NextResponse.json({ error: 'No DLD PDF to remove' }, { status: 404 })
    }

    try {
      await unlink(owner.dldPdfPath)
    } catch {
      // file might already be gone — still clear metadata
    }

    const updated = await prisma.propertyOwner.update({
      where: { id },
      data: {
        dldPdfPath: '',
        dldPdfName: '',
        dldPdfSize: 0,
        dldPdfUploadedAt: null,
      },
      select: {
        dldContractNo: true,
        dldStatus: true,
        dldContractType: true,
        dldSubmittedAt: true,
        dldRegisteredAt: true,
        dldPdfPath: true,
        dldPdfName: true,
        dldPdfSize: true,
        dldPdfUploadedAt: true,
        dldNotes: true,
      },
    })

    await logActivity(
      organizationId,
      session.user.name,
      'DLD PDF Removed',
      `${owner.ownerName} (${owner.buildingName}): ${owner.dldPdfName}`
    )

    return NextResponse.json({ message: 'DLD PDF removed', dld: updated })
  } catch (error) {
    console.error('DELETE /api/owners/[id]/dld/upload error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
