import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { readFile } from 'fs/promises'
import path from 'path'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const organizationId = session.user.organizationId
    const { id, imageId } = await params

    const image = await prisma.buildingImage.findFirst({
      where: { id: imageId, ownerId: id, organizationId },
    })
    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    const rel = image.filePath.replace(/^[/\\]+/, '')
    const abs = path.join(process.cwd(), rel)

    let bytes: Buffer
    try {
      bytes = await readFile(abs)
    } catch {
      return NextResponse.json({ error: 'File missing on disk' }, { status: 404 })
    }

    const body = new Uint8Array(bytes)
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': image.mimeType || 'application/octet-stream',
        'Content-Length': String(bytes.length),
        'Cache-Control': 'private, max-age=300',
        'Content-Disposition': `inline; filename="${image.originalFilename || image.filename}"`,
      },
    })
  } catch (error) {
    console.error('GET image file error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
