import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { readFile, stat } from 'fs/promises'

export const runtime = 'nodejs'

export async function GET(
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
      select: {
        dldPdfPath: true,
        dldPdfName: true,
        dldPdfSize: true,
      },
    })
    if (!owner) {
      return NextResponse.json({ error: 'Owner not found' }, { status: 404 })
    }
    if (!owner.dldPdfPath || !owner.dldPdfName) {
      return NextResponse.json(
        { error: 'No DLD PDF uploaded for this owner' },
        { status: 404 }
      )
    }

    try {
      await stat(owner.dldPdfPath)
    } catch {
      return NextResponse.json(
        { error: 'DLD PDF file is missing on disk' },
        { status: 410 }
      )
    }

    const data = await readFile(owner.dldPdfPath)
    const safeName = owner.dldPdfName.replace(/"/g, '')

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(data.length),
        'Content-Disposition': `attachment; filename="${safeName}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('GET /api/owners/[id]/dld/download error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
