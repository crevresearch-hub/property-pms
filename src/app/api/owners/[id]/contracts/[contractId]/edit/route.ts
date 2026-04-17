import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { createNotification } from '@/lib/notifications'
import { createVersionedContract } from '@/lib/owner-contract-service'
// Email removed per user request - too many emails. Only: contract_sent, admin_owner_signed, final_package.

type EditBody = {
  contractStartDate?: string
  contractEndDate?: string
  contractTerm?: string
  leasingCommissionRes?: number
  leasingCommissionCom?: number
  managementFee?: number
  renewalFeeRes?: number
  renewalFeeCom?: number
  noticePeriodDays?: number
  autoRenew?: boolean
  exclusiveMandate?: boolean
  paymentFrequency?: string
  serviceType?: string
  specialTerms?: string
  customClauseAdditions?: Array<{ title: string; content: string }>
  reason?: string
  sendEmailToOwner?: boolean
}

export async function POST(
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

    const existingContract = await prisma.ownerContract.findFirst({
      where: { id: contractId, ownerId: id, organizationId },
    })
    if (!existingContract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    const owner = await prisma.propertyOwner.findFirst({
      where: { id, organizationId },
    })
    if (!owner) {
      return NextResponse.json({ error: 'Owner not found' }, { status: 404 })
    }

    let body: EditBody = {}
    try {
      body = (await request.json()) as EditBody
    } catch {
      /* ignore */
    }

    // Update PropertyOwner with the new default terms so future contracts use them
    const ownerUpdateData: Record<string, unknown> = {}
    if (body.contractStartDate !== undefined) ownerUpdateData.contractStartDate = body.contractStartDate
    if (body.contractEndDate !== undefined) ownerUpdateData.contractEndDate = body.contractEndDate
    if (body.contractTerm !== undefined) ownerUpdateData.contractTerm = body.contractTerm
    if (body.leasingCommissionRes !== undefined) ownerUpdateData.leasingCommissionRes = Number(body.leasingCommissionRes)
    if (body.leasingCommissionCom !== undefined) ownerUpdateData.leasingCommissionCom = Number(body.leasingCommissionCom)
    if (body.managementFee !== undefined) ownerUpdateData.managementFee = Number(body.managementFee)
    if (body.renewalFeeRes !== undefined) ownerUpdateData.renewalFeeRes = Number(body.renewalFeeRes)
    if (body.renewalFeeCom !== undefined) ownerUpdateData.renewalFeeCom = Number(body.renewalFeeCom)
    if (body.noticePeriodDays !== undefined) ownerUpdateData.noticePeriodDays = Number(body.noticePeriodDays)
    if (body.autoRenew !== undefined) ownerUpdateData.autoRenew = !!body.autoRenew
    if (body.exclusiveMandate !== undefined) ownerUpdateData.exclusiveMandate = !!body.exclusiveMandate
    if (body.paymentFrequency !== undefined) ownerUpdateData.paymentFrequency = body.paymentFrequency
    if (body.serviceType !== undefined) ownerUpdateData.serviceType = body.serviceType
    if (body.specialTerms !== undefined) ownerUpdateData.specialTerms = body.specialTerms
    if (Array.isArray(body.customClauseAdditions)) {
      ownerUpdateData.customClauses = JSON.stringify(body.customClauseAdditions)
    }

    if (Object.keys(ownerUpdateData).length > 0) {
      await prisma.propertyOwner.update({
        where: { id },
        data: ownerUpdateData,
      })
    }

    // Create a new versioned contract (will auto-supersede any Active)
    const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16)
    const reason = body.reason?.trim() || `Amendment - ${stamp}`

    const result = await createVersionedContract({
      organizationId,
      ownerId: id,
      reason,
      createdBy: session.user.name || '',
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    // Explicitly mark the prior (existingContract) as Superseded if not already Active (Active is already handled inside helper)
    if (existingContract.status !== 'Active' && existingContract.id !== result.contract.id) {
      await prisma.ownerContract.update({
        where: { id: existingContract.id },
        data: { status: 'Superseded', supersededById: result.contract.id },
      })
    }

    await logActivity(
      organizationId,
      session.user.name,
      'Amended PM Contract',
      `${result.contract.contractNo} v${result.contract.version} supersedes ${existingContract.contractNo} v${existingContract.version} – ${reason}`
    )

    await createNotification(
      organizationId,
      'staff',
      '',
      'Contract Amended',
      `${result.contract.contractNo} v${result.contract.version} issued for ${result.owner.ownerName} (${reason})`,
      'system'
    )

    // Email removed per user request - too many emails. Only: contract_sent, admin_owner_signed, final_package.

    const { htmlBody: _omit, ...safe } = result.contract
    return NextResponse.json(
      {
        message: 'Contract amended',
        contract: safe,
        owner: result.owner,
        emailSent: false,
        emailError: null,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/owners/[id]/contracts/[contractId]/edit error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
