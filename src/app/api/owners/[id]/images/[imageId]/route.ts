import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { unlink } from 'fs/promises'
import path from 'path'

const ALLOWED_CATEGORIES = new Set(['Exterior', 'Lobby', 'Unit', 'Amenity', 'Other'])

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const organizationId = session.user.organizationId
    const { id, imageId } = await params

    const existing = await prisma.buildingImage.findFirst({
      where: { id: imageId, ownerId: id, organizationId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const data: {
      caption?: string
      category?: string
      isPrimary?: boolean
      sortOrder?: number
    } = {}

    if (typeof body.caption === 'string') data.caption = body.caption
    if (typeof body.category === 'string' && ALLOWED_CATEGORIES.has(body.category)) {
      data.category = body.category
    }
    if (typeof body.isPrimary === 'boolean') data.isPrimary = body.isPrimary
    if (typeof body.sortOrder === 'number' && Number.isFinite(body.sortOrder)) {
      data.sortOrder = body.sortOrder
    }

    if (data.isPrimary === true) {
      await prisma.buildingImage.updateMany({
        where: {
          ownerId: id,
          organizationId,
          isPrimary: true,
          id: { not: imageId },
        },
        data: { isPrimary: false },
      })
    }

    const updated = await prisma.buildingImage.update({
      where: { id: imageId },
      data,
    })

    await logActivity(
      organizationId,
      session.user.name,
      'Updated Building Image',
      `${updated.filename} – ${updated.category}${updated.isPrimary ? ' (primary)' : ''}`
    )

    return NextResponse.json({ image: updated })
  } catch (error) {
    console.error('PUT /api/owners/[id]/images/[imageId] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const organizationId = session.user.organizationId
    const { id, imageId } = await params

    const existing = await prisma.buildingImage.findFirst({
      where: { id: imageId, ownerId: id, organizationId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    await prisma.buildingImage.delete({ where: { id: imageId } })

    // Try to remove the file from disk; ignore failures.
    try {
      const rel = existing.filePath.replace(/^[/\\]+/, '')
      const abs = path.join(process.cwd(), rel)
      await unlink(abs)
    } catch (err) {
      console.warn('Failed to remove image file:', existing.filePath, err)
    }

    await logActivity(
      organizationId,
      session.user.name,
      'Deleted Building Image',
      `${existing.filename} (${existing.category})`
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/owners/[id]/images/[imageId] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
