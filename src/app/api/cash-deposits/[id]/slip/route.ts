import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { writeFile, mkdir, readFile } from 'fs/promises'
import path from 'path'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

// POST: upload a deposit slip and attach it to the cash deposit row.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const organizationId = session.user.organizationId
    const { id } = await params
    const existing = await prisma.cashDeposit.findFirst({ where: { id, organizationId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const fd = await request.formData()
    const file = fd.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

    const original = (file as { name?: string }).name || 'slip.pdf'
    const ext = (original.split('.').pop() || 'pdf').toLowerCase()
    const safeName = `${Date.now()}_slip.${ext}`
    const buf = Buffer.from(await file.arrayBuffer())

    const uploadDir = path.join(process.cwd(), 'uploads', 'cash-deposits', id)
    await mkdir(uploadDir, { recursive: true }).catch(() => {})
    await writeFile(path.join(uploadDir, safeName), buf)

    const updated = await prisma.cashDeposit.update({
      where: { id },
      data: {
        slipPath: `uploads/cash-deposits/${id}/${safeName}`,
        slipFilename: original,
      },
    })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('POST /api/cash-deposits/[id]/slip error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET: stream the deposit slip back (for viewing/downloading).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const organizationId = session.user.organizationId
    const { id } = await params
    const dep = await prisma.cashDeposit.findFirst({ where: { id, organizationId } })
    if (!dep || !dep.slipPath) return NextResponse.json({ error: 'No slip' }, { status: 404 })

    const fullPath = path.join(process.cwd(), dep.slipPath)
    const buf = await readFile(fullPath).catch(() => null)
    if (!buf) return NextResponse.json({ error: 'File missing' }, { status: 410 })

    const ext = (dep.slipFilename.split('.').pop() || '').toLowerCase()
    const mime = MIME_BY_EXT[ext] || 'application/octet-stream'
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': mime,
        'Content-Disposition': `inline; filename="${dep.slipFilename || 'slip'}"`,
        'Cache-Control': 'private, max-age=60',
      },
    })
  } catch (error) {
    console.error('GET /api/cash-deposits/[id]/slip error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
