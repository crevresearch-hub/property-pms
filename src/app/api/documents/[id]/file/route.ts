import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { readFile } from 'fs/promises'
import path from 'path'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { isCloudUrl } from '@/lib/storage'

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const doc = await prisma.tenantDocument.findFirst({
      where: { id, organizationId: session.user.organizationId },
    })
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // If the file is on cloud storage (Vercel Blob), redirect to its public URL.
    if (isCloudUrl(doc.filePath)) {
      return NextResponse.redirect(doc.filePath, 307)
    }

    // Otherwise read from local disk (dev).
    const fullPath = path.join(process.cwd(), doc.filePath)
    const buf = await readFile(fullPath).catch(() => null)
    if (!buf) return NextResponse.json({ error: 'File missing on disk' }, { status: 410 })

    const ext = (doc.filename.split('.').pop() || '').toLowerCase()
    const mime = MIME_BY_EXT[ext] || 'application/octet-stream'

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': mime,
        'Content-Disposition': `inline; filename="${doc.originalFilename || doc.filename}"`,
        'Cache-Control': 'private, max-age=60',
      },
    })
  } catch (error) {
    console.error('GET /api/documents/[id]/file error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
