import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { buildContractHTML, type PropertyOwnerRecord } from '@/lib/contract-builder'
import { getDefaultContractContent, mergeWithDefaults } from '@/lib/contract-clauses-default'
import { createVersionedContract } from '@/lib/owner-contract-service'

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
      include: { organization: { select: { name: true } } },
    })
    if (!owner) {
      return NextResponse.json({ error: 'Owner not found' }, { status: 404 })
    }

    const baseUrl = process.env.NEXTAUTH_URL || ''

    const primaryImage = await prisma.buildingImage.findFirst({
      where: { ownerId: owner.id, organizationId, isPrimary: true },
      select: { id: true },
    })
    const primaryImagePath = primaryImage
      ? `/api/owners/${owner.id}/images/${primaryImage.id}/file`
      : undefined

    // Find the most recent signed / active contract (if any) so the rendered
    // HTML reflects the actual executed signatures.
    const latestSigned = await prisma.ownerContract.findFirst({
      where: {
        organizationId,
        ownerId: owner.id,
        OR: [
          { ownerSignedAt: { not: null } },
          { creSignedAt: { not: null } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        ownerSignatureImage: true,
        creSignatureImage: true,
        ownerSignedAt: true,
        creSignedAt: true,
        ownerIpAddress: true,
        signedByOwnerName: true,
        signedByCREName: true,
        signatureToken: true,
      },
    })

    const ownerForBuilder = {
      ...owner,
      signatureToken: latestSigned?.signatureToken || (owner as unknown as { signatureToken?: string }).signatureToken || '',
      ownerSignatureImage: latestSigned?.ownerSignatureImage || undefined,
      creSignatureImage: latestSigned?.creSignatureImage || undefined,
      ownerSignedAt: latestSigned?.ownerSignedAt,
      creSignedAt: latestSigned?.creSignedAt,
      ownerIpAddress: latestSigned?.ownerIpAddress,
      signedByOwnerName: latestSigned?.signedByOwnerName,
      signedByCREName: latestSigned?.signedByCREName,
    } as unknown as PropertyOwnerRecord

    let content = getDefaultContractContent()
    if (owner.contractClausesJson && owner.contractClausesJson.trim()) {
      try {
        content = mergeWithDefaults(JSON.parse(owner.contractClausesJson))
      } catch {
        // fall back to defaults
      }
    }

    const html = buildContractHTML(
      ownerForBuilder,
      owner.organization?.name || 'Continental Real Estate',
      baseUrl,
      primaryImagePath,
      content
    )

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('GET /api/owners/[id]/contract error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
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

    let reason = 'Initial contract'
    try {
      const body = await request.json()
      if (body?.reason) reason = String(body.reason)
    } catch {
      /* no body */
    }

    const result = await createVersionedContract({
      organizationId,
      ownerId: id,
      reason,
      createdBy: session.user.name || '',
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    await logActivity(
      organizationId,
      session.user.name,
      'Generated PM Contract',
      `${result.contract.contractNo} v${result.contract.version} – ${result.owner.ownerName} – ${result.owner.buildingName}`
    )

    const { htmlBody: _omit, ...safe } = result.contract
    return NextResponse.json({
      message: 'Contract generated',
      signatureToken: result.contract.signatureToken,
      contract: safe,
      owner: result.owner,
    })
  } catch (error) {
    console.error('POST /api/owners/[id]/contract error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
