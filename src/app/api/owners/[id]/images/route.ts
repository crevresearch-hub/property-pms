import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_CATEGORIES = new Set(['Exterior', 'Lobby', 'Unit', 'Amenity', 'Other'])

function extFromMime(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'bin'
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const organizationId = session.user.organizationId
    const { id } = await params

    const owner = await prisma.propertyOwner.findFirst({
      where: { id, organizationId },
      select: { id: true },
    })
    if (!owner) return NextResponse.json({ error: 'Owner not found' }, { status: 404 })

    const images = await prisma.buildingImage.findMany({
      where: { ownerId: id, organizationId },
      orderBy: [
        { isPrimary: 'desc' },
        { sortOrder: 'asc' },
        { uploadedAt: 'desc' },
      ],
    })

    return NextResponse.json({ images })
  } catch (error) {
    console.error('GET /api/owners/[id]/images error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
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

    const owner = await prisma.propertyOwner.findFirst({
      where: { id, organizationId },
      select: { id: true, ownerName: true, buildingName: true },
    })
    if (!owner) return NextResponse.json({ error: 'Owner not found' }, { status: 404 })

    const formData = await request.formData()
    const file = formData.get('file')
    const caption = (formData.get('caption') as string | null) || ''
    let category = (formData.get('category') as string | null) || 'Exterior'
    const isPrimaryRaw = formData.get('isPrimary')
    const isPrimary =
      isPrimaryRaw === 'true' || isPrimaryRaw === '1' || isPrimaryRaw === 'on'

    if (!ALLOWED_CATEGORIES.has(category)) category = 'Other'

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, WebP' },
        { status: 400 }
      )
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: 'File too large. Max 5MB per image' },
        { status: 400 }
      )
    }

    const ext = extFromMime(file.type)
    const filename = `${crypto.randomUUID()}.${ext}`
    const relDir = path.posix.join('uploads', 'buildings', id)
    const absDir = path.join(process.cwd(), relDir)
    await mkdir(absDir, { recursive: true })

    const absPath = path.join(absDir, filename)
    const bytes = Buffer.from(await file.arrayBuffer())
    await writeFile(absPath, bytes)

    const filePath = `/${path.posix.join(relDir, filename)}`

    if (isPrimary) {
      await prisma.buildingImage.updateMany({
        where: { ownerId: id, organizationId, isPrimary: true },
        data: { isPrimary: false },
      })
    }

    const created = await prisma.buildingImage.create({
      data: {
        organizationId,
        ownerId: id,
        filename,
        originalFilename: file.name,
        filePath,
        fileSize: file.size,
        mimeType: file.type,
        caption,
        category,
        isPrimary,
        sortOrder: 0,
        uploadedBy: session.user.name || session.user.email || '',
      },
    })

    await logActivity(
      organizationId,
      session.user.name,
      'Uploaded Building Image',
      `${owner.ownerName} – ${owner.buildingName} (${category}${isPrimary ? ', primary' : ''})`
    )

    return NextResponse.json({ image: created }, { status: 201 })
  } catch (error) {
    console.error('POST /api/owners/[id]/images error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
