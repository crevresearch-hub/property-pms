import { NextRequest, NextResponse } from 'next/server'
import { getTenantSession } from '@/lib/tenant-auth'
import prisma from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

export async function POST(request: NextRequest) {
  const session = getTenantSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const docType = formData.get('docType') as string | null
    const expiryDate = formData.get('expiryDate') as string | null

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be under 10MB' }, { status: 400 })
    }

    // Create upload directory
    const uploadDir = path.join(process.cwd(), 'uploads', `tenant_${session.id}`)
    await mkdir(uploadDir, { recursive: true })

    // Generate unique filename
    const timestamp = Date.now()
    const ext = path.extname(file.name)
    const safeName = file.name
      .replace(ext, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 50)
    const filename = `${timestamp}_${safeName}${ext}`
    const filePath = path.join(uploadDir, filename)

    // Write file to disk
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Record in database
    const document = await prisma.tenantDocument.create({
      data: {
        organizationId: session.orgId,
        tenantId: session.id,
        docType: docType || 'Other',
        filename,
        originalFilename: file.name,
        filePath: `uploads/tenant_${session.id}/${filename}`,
        fileSize: buffer.length,
        expiryDate: expiryDate || '',
        status: 'Uploaded',
      },
    })

    return NextResponse.json(document, { status: 201 })
  } catch (error) {
    console.error('POST /api/tenant/documents/upload error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
