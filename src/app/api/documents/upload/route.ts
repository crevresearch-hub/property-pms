import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import path from 'path'
import { saveFile } from '@/lib/storage'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const tenantId = formData.get('tenantId') as string | null
    const docType = formData.get('docType') as string | null
    const expiryDate = formData.get('expiryDate') as string | null

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 })
    }

    // Verify tenant belongs to organization
    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId, organizationId },
    })
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    const timestamp = Date.now()
    const ext = path.extname(file.name)
    const safeName = file.name
      .replace(ext, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 50)
    const filename = `${timestamp}_${safeName}${ext}`

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const saved = await saveFile(buffer, tenantId, filename, file.type || 'application/octet-stream')

    const document = await prisma.tenantDocument.create({
      data: {
        organizationId,
        tenantId,
        docType: docType || 'Other',
        filename,
        originalFilename: file.name,
        filePath: saved.filePath,
        fileSize: saved.size,
        expiryDate: expiryDate || '',
        status: 'Uploaded',
      },
      include: {
        tenant: { select: { id: true, name: true } },
      },
    })

    await logActivity(
      organizationId,
      session.user.name,
      'Uploaded Document',
      `${docType || 'Other'} uploaded for ${tenant.name} - ${file.name}`
    )

    return NextResponse.json(document, { status: 201 })
  } catch (error) {
    console.error('POST /api/documents/upload error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
