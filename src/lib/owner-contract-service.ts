import crypto from 'crypto'
import prisma from '@/lib/prisma'
import { buildContractHTML, type PropertyOwnerRecord } from '@/lib/contract-builder'
import { mergeWithDefaults, type ContractContent } from '@/lib/contract-clauses-default'

export type CreateContractInput = {
  organizationId: string
  ownerId: string
  reason?: string
  createdBy?: string
}

export type CreateContractResult =
  | { ok: false; status: number; error: string }
  | { ok: true; contract: Awaited<ReturnType<typeof prisma.ownerContract.create>>; owner: Awaited<ReturnType<typeof prisma.propertyOwner.update>> }

/**
 * Generate a unique sequential contract number per organization for the given year.
 * Format: PMA-YYYY-NNNN
 */
export async function generateContractNo(organizationId: string, year: number): Promise<string> {
  const prefix = `PMA-${year}-`
  const last = await prisma.ownerContract.findFirst({
    where: {
      organizationId,
      contractNo: { startsWith: prefix },
    },
    orderBy: { contractNo: 'desc' },
    select: { contractNo: true },
  })
  let next = 1
  if (last) {
    const tail = last.contractNo.slice(prefix.length)
    const n = parseInt(tail, 10)
    if (!Number.isNaN(n)) next = n + 1
  }
  return `${prefix}${String(next).padStart(4, '0')}`
}

export async function createVersionedContract(
  input: CreateContractInput
): Promise<CreateContractResult> {
  const { organizationId, ownerId, reason = 'Initial contract', createdBy = '' } = input

  const owner = await prisma.propertyOwner.findFirst({
    where: { id: ownerId, organizationId },
    include: { organization: { select: { name: true } } },
  })
  if (!owner) {
    return { ok: false, status: 404, error: 'Owner not found' }
  }

  // Determine new version number
  const latest = await prisma.ownerContract.findFirst({
    where: { organizationId, ownerId },
    orderBy: { version: 'desc' },
    select: { id: true, version: true, status: true },
  })
  const version = (latest?.version || 0) + 1

  const contractNo = await generateContractNo(organizationId, new Date().getFullYear())
  const signatureToken = crypto.randomBytes(24).toString('hex')

  const baseUrl = process.env.NEXTAUTH_URL || ''

  const primaryImage = await prisma.buildingImage.findFirst({
    where: { ownerId, organizationId, isPrimary: true },
    select: { id: true },
  })
  const primaryImagePath = primaryImage
    ? `/api/owners/${ownerId}/images/${primaryImage.id}/file`
    : undefined

  // Load custom content if the owner has saved edits
  let customContent: ContractContent | undefined
  const raw = (owner as unknown as { contractClausesJson?: string }).contractClausesJson
  if (raw && typeof raw === 'string' && raw.trim()) {
    try {
      customContent = mergeWithDefaults(JSON.parse(raw) as Partial<ContractContent>)
    } catch (err) {
      console.error('Failed to parse contractClausesJson for owner', ownerId, err)
      customContent = undefined
    }
  }

  const htmlBody = buildContractHTML(
    owner as unknown as PropertyOwnerRecord,
    owner.organization?.name || 'CRE',
    baseUrl,
    primaryImagePath,
    customContent
  )

  const now = new Date()

  const contract = await prisma.ownerContract.create({
    data: {
      organizationId,
      ownerId,
      contractNo,
      version,
      status: 'Draft',
      serviceType: owner.serviceType,
      startDate: owner.contractStartDate,
      endDate: owner.contractEndDate,
      contractTerm: owner.contractTerm,
      leasingCommissionRes: owner.leasingCommissionRes,
      leasingCommissionCom: owner.leasingCommissionCom,
      managementFee: owner.managementFee,
      renewalFeeRes: owner.renewalFeeRes,
      renewalFeeCom: owner.renewalFeeCom,
      noticePeriodDays: owner.noticePeriodDays,
      autoRenew: owner.autoRenew,
      exclusiveMandate: owner.exclusiveMandate,
      paymentFrequency: owner.paymentFrequency,
      htmlBody,
      signatureToken,
      generatedAt: now,
      reason,
      createdBy,
    },
  })

  // DO NOT supersede the old Active contract yet.
  // Old contract stays Active (legally valid) until the new one is fully signed.
  // The supersede happens in the cre-sign endpoint when both parties sign the new version.
  // Reference: legally correct UAE PM contract amendment workflow.
  // Just link the new draft as a pending amendment of the active one (informational).

  const updatedOwner = await prisma.propertyOwner.update({
    where: { id: ownerId },
    data: {
      signatureToken,
      contractSentAt: now,
      proposalSentAt: owner.proposalSentAt || now,
      stage: 'Proposal Sent',
    },
  })

  return { ok: true, contract, owner: updatedOwner }
}
