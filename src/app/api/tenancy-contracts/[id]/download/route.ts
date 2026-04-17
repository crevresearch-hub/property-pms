import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { readFile, stat } from 'fs/promises'
import path from 'path'

export const runtime = 'nodejs'

function contentTypeForExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.pdf':
      return 'application/pdf'
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    default:
      return 'application/octet-stream'
  }
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

    const contract = await prisma.tenancyContract.findFirst({
      where: { id, organizationId },
      select: {
        signedFilePath: true,
        signedFileName: true,
        signedFileSize: true,
      },
    })
    if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    if (!contract.signedFilePath || !contract.signedFileName) {
      return NextResponse.json({ error: 'No signed file uploaded for this contract' }, { status: 404 })
    }

    try {
      await stat(contract.signedFilePath)
    } catch {
      return NextResponse.json({ error: 'Signed file is missing on disk' }, { status: 410 })
    }

    const data = await readFile(contract.signedFilePath)
    const ext = path.extname(contract.signedFileName)
    const contentType = contentTypeForExt(ext)
    const safeName = contract.signedFileName.replace(/"/g, '')

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(data.length),
        'Content-Disposition': `attachment; filename="${safeName}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('GET /api/tenancy-contracts/[id]/download error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
