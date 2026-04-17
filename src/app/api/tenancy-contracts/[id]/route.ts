import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getTenantSession } from '@/lib/tenant-auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { createNotification } from '@/lib/notifications'
import { sendEmail } from '@/lib/email'
import {
  tenancyContractSentTemplate,
  tenancyContractSignedTemplate,
} from '@/lib/email-templates'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const staffSession = await getServerSession(authOptions)
    const tenantSession = staffSession ? null : getTenantSession(request)
    if (!staffSession && !tenantSession) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const format = request.nextUrl.searchParams.get('format')

    const whereClause = staffSession
      ? { id, organizationId: staffSession.user.organizationId }
      : { id, organizationId: tenantSession!.orgId, tenantId: tenantSession!.id }

    const contract = await prisma.tenancyContract.findFirst({
      where: whereClause,
    })
    if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 })

    if (format === 'html') {
      return new NextResponse(contract.htmlBody, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      })
    }
    return NextResponse.json({ contract })
  } catch (error) {
    console.error('GET /api/tenancy-contracts/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH — partial field update for simple fields like notes / internalNotes.
 * Use this (not PUT) when you just want to save text fields without running
 * the send/sign/terminate workflow logic.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const organizationId = session.user.organizationId
    const { id } = await params
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

    const contract = await prisma.tenancyContract.findFirst({
      where: { id, organizationId },
    })
    if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (typeof body.notes === 'string') data.notes = body.notes
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No updatable fields in body' }, { status: 400 })
    }

    const updated = await prisma.tenancyContract.update({ where: { id }, data })
    return NextResponse.json({ message: 'Updated', contract: { id: updated.id } })
  } catch (error) {
    console.error('PATCH /api/tenancy-contracts/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const organizationId = session.user.organizationId
    const { id } = await params
    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const action = String(body.action || '').toLowerCase()
    if (!['send', 'sign', 'terminate', 'cancel'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Use send | sign | terminate | cancel' },
        { status: 400 }
      )
    }

    const contract = await prisma.tenancyContract.findFirst({
      where: { id, organizationId },
      include: { tenant: true },
    })
    if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 })

    const owner = contract.ownerId
      ? await prisma.propertyOwner.findFirst({ where: { id: contract.ownerId, organizationId } })
      : null

    const baseUrl = process.env.NEXTAUTH_URL || ''
    const now = new Date()

    if (action === 'send') {
      const updated = await prisma.tenancyContract.update({
        where: { id },
        data: { status: 'Sent', sentAt: now },
      })
      await logActivity(
        organizationId,
        session.user.name,
        'Sent Tenancy Contract',
        `${contract.contractNo} v${contract.version} → ${contract.tenant.email}`
      )
      if (contract.tenant.email) {
        const tpl = tenancyContractSentTemplate(
          contract.tenant as never,
          contract as never,
          (owner as never) || null,
          baseUrl
        )
        await sendEmail({
          organizationId,
          to: contract.tenant.email,
          toName: contract.tenant.name,
          subject: tpl.subject,
          html: tpl.html,
          template: 'tenancy_contract_sent',
          triggeredBy: session.user.name,
          refType: 'tenancy_contract',
          refId: contract.id,
        })
      }
      const { htmlBody: _o, ...safe } = updated
      return NextResponse.json({ message: 'Contract marked as sent', contract: safe })
    }

    if (action === 'sign') {
      // Mark previous Active for same tenant+unit as Renewed
      await prisma.tenancyContract.updateMany({
        where: {
          organizationId,
          tenantId: contract.tenantId,
          unitId: contract.unitId,
          status: 'Active',
          id: { not: id },
        },
        data: { status: 'Renewed' },
      })

      const updated = await prisma.tenancyContract.update({
        where: { id },
        data: {
          status: 'Active',
          signedByTenantAt: contract.signedByTenantAt || now,
          signedByLandlordAt: contract.signedByLandlordAt || now,
          effectiveAt: contract.effectiveAt || now,
        },
      })
      await logActivity(
        organizationId,
        session.user.name,
        'Signed Tenancy Contract',
        `${contract.contractNo} v${contract.version}`
      )
      await createNotification(
        organizationId,
        'staff',
        '',
        'Tenancy Contract Signed',
        `${contract.contractNo} signed for ${contract.tenant.name}`,
        'system'
      )
      if (contract.tenant.email) {
        const tpl = tenancyContractSignedTemplate(
          contract.tenant as never,
          updated as never,
          (owner as never) || null,
          baseUrl
        )
        await sendEmail({
          organizationId,
          to: contract.tenant.email,
          toName: contract.tenant.name,
          subject: tpl.subject,
          html: tpl.html,
          template: 'tenancy_contract_signed',
          triggeredBy: session.user.name,
          refType: 'tenancy_contract',
          refId: contract.id,
        })
      }
      if (owner?.email) {
        const tpl = tenancyContractSignedTemplate(
          contract.tenant as never,
          updated as never,
          owner as never,
          baseUrl
        )
        await sendEmail({
          organizationId,
          to: owner.email,
          toName: owner.ownerName,
          subject: tpl.subject,
          html: tpl.html,
          template: 'tenancy_contract_signed',
          triggeredBy: session.user.name,
          refType: 'tenancy_contract',
          refId: contract.id,
        })
      }
      const { htmlBody: _o, ...safe } = updated
      return NextResponse.json({ message: 'Contract signed', contract: safe })
    }

    if (action === 'terminate') {
      const terminationReason = String(body.reason || '')
      const updated = await prisma.tenancyContract.update({
        where: { id },
        data: { status: 'Terminated', terminatedAt: now, terminationReason },
      })
      await logActivity(
        organizationId,
        session.user.name,
        'Terminated Tenancy Contract',
        `${contract.contractNo} v${contract.version} – ${terminationReason}`
      )
      const { htmlBody: _o, ...safe } = updated
      return NextResponse.json({ message: 'Contract terminated', contract: safe })
    }

    // cancel
    const updated = await prisma.tenancyContract.update({
      where: { id },
      data: { status: 'Cancelled' },
    })
    await logActivity(
      organizationId,
      session.user.name,
      'Cancelled Tenancy Contract',
      `${contract.contractNo} v${contract.version}`
    )
    const { htmlBody: _o, ...safe } = updated
    return NextResponse.json({ message: 'Contract cancelled', contract: safe })
  } catch (error) {
    console.error('PUT /api/tenancy-contracts/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
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
    })
    if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    if (contract.status !== 'Draft') {
      return NextResponse.json(
        { error: `Only Draft contracts can be deleted (current status: ${contract.status})` },
        { status: 400 }
      )
    }

    await prisma.tenancyContract.delete({ where: { id } })
    await logActivity(
      organizationId,
      session.user.name,
      'Deleted Tenancy Contract',
      `${contract.contractNo} v${contract.version}`
    )
    return NextResponse.json({ message: 'Contract deleted' })
  } catch (error) {
    console.error('DELETE /api/tenancy-contracts/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
