import { NextRequest, NextResponse } from 'next/server'
import { getTenantSession } from '@/lib/tenant-auth'
import prisma from '@/lib/prisma'
import { readFile } from 'fs/promises'
import path from 'path'

function contentTypeFor(filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  switch (ext) {
    case '.pdf':
      return 'application/pdf'
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.gif':
      return 'image/gif'
    case '.webp':
      return 'image/webp'
    case '.txt':
      return 'text/plain'
    case '.doc':
      return 'application/msword'
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    default:
      return 'application/octet-stream'
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getTenantSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params

    const doc = await prisma.tenantDocument.findFirst({
      where: {
        id,
        tenantId: session.id,
        organizationId: session.orgId,
      },
    })

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // filePath stored as relative "uploads/tenant_<id>/filename" — normalize to absolute
    const rel = doc.filePath.replace(/^[/\\]+/, '')
    const abs = path.isAbsolute(doc.filePath)
      ? doc.filePath
      : path.join(process.cwd(), rel)

    // Safety: ensure resolved path stays under project uploads dir
    const uploadsRoot = path.join(process.cwd(), 'uploads')
    const resolved = path.resolve(abs)
    if (!resolved.startsWith(path.resolve(uploadsRoot))) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })
    }

    const buffer = await readFile(resolved)
    const mime = contentTypeFor(doc.originalFilename || doc.filename)

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Content-Length': String(buffer.length),
        'Content-Disposition': `inline; filename="${encodeURIComponent(
          doc.originalFilename || doc.filename
        )}"`,
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    })
  } catch (error) {
    console.error('GET /api/tenant/documents/[id]/file error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
