import { NextRequest, NextResponse } from 'next/server'
import { getTenantSession } from '@/lib/tenant-auth'
import prisma from '@/lib/prisma'
import { createNotification } from '@/lib/notifications'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getTenantSession(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await params
    const v = await prisma.violation.findFirst({
      where: { id, organizationId: session.orgId, tenantId: session.id },
    })
    if (!v) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (v.acknowledgedAt) return NextResponse.json({ error: 'Already acknowledged' }, { status: 400 })

    const updated = await prisma.violation.update({
      where: { id },
      data: { acknowledgedAt: new Date(), status: 'Acknowledged' },
    })
    await createNotification(
      session.orgId,
      'staff',
      '',
      `Violation Acknowledged: ${v.violationNo}`,
      `${session.name} acknowledged ${v.violationNo} (${v.type})`,
      'violation'
    )
    return NextResponse.json(updated)
  } catch (error) {
    console.error('POST /api/tenant/violations/[id]/acknowledge error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
