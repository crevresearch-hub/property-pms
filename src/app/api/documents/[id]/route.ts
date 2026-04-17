import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { createNotification } from '@/lib/notifications'

/** GET — return a single TenantDocument's metadata (no file body). */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const doc = await prisma.tenantDocument.findFirst({
      where: { id, organizationId: session.user.organizationId },
    })
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(doc)
  } catch (error) {
    console.error('GET /api/documents/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    const { id } = await params
    const body = await request.json()

    const existing = await prisma.tenantDocument.findFirst({
      where: { id, organizationId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const { status, reviewNotes } = body

    if (!status || !['Approved', 'Rejected'].includes(status)) {
      return NextResponse.json(
        { error: 'Status must be Approved or Rejected' },
        { status: 400 }
      )
    }

    const document = await prisma.tenantDocument.update({
      where: { id },
      data: {
        status,
        reviewNotes: reviewNotes || '',
        reviewedBy: session.user.name,
        reviewedAt: new Date(),
      },
      include: {
        tenant: { select: { id: true, name: true } },
      },
    })

    // Notify tenant about review
    await createNotification(
      organizationId,
      'tenant',
      document.tenantId,
      `Document ${status}: ${document.docType}`,
      reviewNotes || `Your ${document.docType} document has been ${status.toLowerCase()}.`,
      'system'
    )

    await logActivity(
      organizationId,
      session.user.name,
      `${status} Document`,
      `${document.docType} for ${document.tenant?.name || 'Unknown'} - ${status}`
    )

    return NextResponse.json(document)
  } catch (error) {
    console.error('PUT /api/documents/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
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

    const existing = await prisma.tenantDocument.findFirst({
      where: { id, organizationId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    await prisma.tenantDocument.delete({ where: { id } })

    await logActivity(
      organizationId,
      session.user.name,
      'Deleted Document',
      `${existing.docType} - ${existing.originalFilename}`
    )

    return NextResponse.json({ message: 'Document deleted' })
  } catch (error) {
    console.error('DELETE /api/documents/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
