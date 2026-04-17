import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { createNotification } from '@/lib/notifications'
import { buildContractHTML, type PropertyOwnerRecord } from '@/lib/contract-builder'
import { getDefaultContractContent, mergeWithDefaults } from '@/lib/contract-clauses-default'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contractId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    const { id, contractId } = await params
    const format = request.nextUrl.searchParams.get('format')

    const contract = await prisma.ownerContract.findFirst({
      where: { id: contractId, ownerId: id, organizationId },
      include: {
        owner: { include: { organization: { select: { name: true } } } },
      },
    })
    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    if (format === 'html') {
      // Rebuild HTML on-the-fly so the rendered contract includes the latest
      // signature data (images, names, timestamps, IP) attached to the contract.
      const baseUrl = process.env.NEXTAUTH_URL || ''
      const primaryImage = await prisma.buildingImage.findFirst({
        where: { ownerId: contract.ownerId, organizationId, isPrimary: true },
        select: { id: true },
      })
      const primaryImagePath = primaryImage
        ? `/api/owners/${contract.ownerId}/images/${primaryImage.id}/file`
        : undefined

      // Use owner's custom clause content if present, else defaults.
      let content = getDefaultContractContent()
      const ownerWithClauses = contract.owner as unknown as { contractClausesJson?: string | null }
      if (ownerWithClauses?.contractClausesJson) {
        try {
          const parsed = JSON.parse(ownerWithClauses.contractClausesJson)
          content = mergeWithDefaults(parsed)
        } catch {
          content = getDefaultContractContent()
        }
      }

      const ownerForBuilder = {
        ...contract.owner,
        signatureToken: contract.signatureToken,
        ownerSignatureImage: contract.ownerSignatureImage || undefined,
        creSignatureImage: contract.creSignatureImage || undefined,
        ownerSignedAt: contract.ownerSignedAt,
        creSignedAt: contract.creSignedAt,
        ownerIpAddress: contract.ownerIpAddress,
        signedByOwnerName: contract.signedByOwnerName,
        signedByCREName: contract.signedByCREName,
      } as unknown as PropertyOwnerRecord

      const html = buildContractHTML(
        ownerForBuilder,
        contract.owner.organization?.name || 'Continental Real Estate',
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
    }

    return NextResponse.json({ contract })
  } catch (error) {
    console.error('GET /api/owners/[id]/contracts/[contractId] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contractId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    const { id, contractId } = await params

    const body = await request.json().catch(() => ({} as any))
    const action = String(body?.action || '').toLowerCase()
    if (!['send', 'sign', 'cancel'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Use send | sign | cancel' }, { status: 400 })
    }

    const contract = await prisma.ownerContract.findFirst({
      where: { id: contractId, ownerId: id, organizationId },
      include: { owner: true },
    })
    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    const now = new Date()

    if (action === 'send') {
      const sentToEmail = String(body?.sentToEmail || contract.owner.email || '')
      if (!sentToEmail) {
        return NextResponse.json({ error: 'No email address provided' }, { status: 400 })
      }
      const updated = await prisma.ownerContract.update({
        where: { id: contractId },
        data: { status: 'Sent', sentAt: now, sentToEmail },
      })
      await prisma.propertyOwner.update({
        where: { id },
        data: {
          emailSentAt: now,
          contractSentAt: contract.owner.contractSentAt || now,
          stage: contract.owner.stage === 'Lead' ? 'Proposal Sent' : contract.owner.stage,
        },
      })
      await logActivity(
        organizationId,
        session.user.name,
        'Sent PM Contract',
        `${contract.contractNo} v${contract.version} → ${sentToEmail}`
      )
      await createNotification(
        organizationId,
        'staff',
        '',
        'Contract Sent',
        `${contract.contractNo} sent to ${sentToEmail}`,
        'system'
      )
      const { htmlBody: _o, ...safe } = updated
      return NextResponse.json({ message: 'Contract marked as sent', contract: safe })
    }

    if (action === 'sign') {
      const signedByOwnerName = String(body?.signedByOwnerName || contract.owner.ownerName || '')
      const signedByCREName = String(body?.signedByCREName || session.user.name || '')

      // Mark any other Active contract for this owner as Superseded
      await prisma.ownerContract.updateMany({
        where: {
          organizationId,
          ownerId: id,
          status: 'Active',
          id: { not: contractId },
        },
        data: { status: 'Superseded', supersededById: contractId },
      })

      const updated = await prisma.ownerContract.update({
        where: { id: contractId },
        data: {
          status: 'Active',
          signedAt: contract.signedAt || now,
          signedByOwnerName,
          signedByCREName,
        },
      })
      await prisma.propertyOwner.update({
        where: { id },
        data: {
          signedByOwner: true,
          signedByCRE: true,
          contractSignedAt: now,
          stage: 'Contract Signed',
        },
      })
      await logActivity(
        organizationId,
        session.user.name,
        'Signed PM Contract',
        `${contract.contractNo} v${contract.version} – owner: ${signedByOwnerName}; CRE: ${signedByCREName}`
      )
      await createNotification(
        organizationId,
        'staff',
        '',
        'Contract Signed',
        `${contract.contractNo} signed by ${signedByOwnerName}`,
        'system'
      )
      const { htmlBody: _o, ...safe } = updated
      return NextResponse.json({ message: 'Contract marked as signed', contract: safe })
    }

    // cancel
    const updated = await prisma.ownerContract.update({
      where: { id: contractId },
      data: { status: 'Cancelled' },
    })
    await logActivity(
      organizationId,
      session.user.name,
      'Cancelled PM Contract',
      `${contract.contractNo} v${contract.version}`
    )
    const { htmlBody: _o, ...safe } = updated
    return NextResponse.json({ message: 'Contract cancelled', contract: safe })
  } catch (error) {
    console.error('PUT /api/owners/[id]/contracts/[contractId] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; contractId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    const { id, contractId } = await params

    const contract = await prisma.ownerContract.findFirst({
      where: { id: contractId, ownerId: id, organizationId },
    })
    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }
    if (contract.status !== 'Draft') {
      return NextResponse.json(
        { error: `Only Draft contracts can be deleted (current status: ${contract.status})` },
        { status: 400 }
      )
    }

    await prisma.ownerContract.delete({ where: { id: contractId } })

    await logActivity(
      organizationId,
      session.user.name,
      'Deleted PM Contract',
      `${contract.contractNo} v${contract.version}`
    )

    return NextResponse.json({ message: 'Contract deleted' })
  } catch (error) {
    console.error('DELETE /api/owners/[id]/contracts/[contractId] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
