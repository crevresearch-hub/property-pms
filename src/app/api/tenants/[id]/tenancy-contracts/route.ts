import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import crypto from 'crypto'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { createNotification } from '@/lib/notifications'
import { sendEmail } from '@/lib/email'
import { tenancyContractGeneratedTemplate } from '@/lib/email-templates'
import {
  buildTenancyContractHTML,
  type TenantRecord,
  type UnitRecord,
  type OwnerRecord,
  type TenancyContractRecord,
} from '@/lib/tenancy-contract-builder'
import { buildDldTenancyContractHTML } from '@/lib/dld-tenancy-contract-builder'

async function generateContractNo(organizationId: string, year: number): Promise<string> {
  const prefix = `TC-${year}-`
  const last = await prisma.tenancyContract.findFirst({
    where: { organizationId, contractNo: { startsWith: prefix } },
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

function addDays(dateStr: string, days: number): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
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

    const tenant = await prisma.tenant.findFirst({
      where: { id, organizationId },
      select: { id: true },
    })
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const contracts = await prisma.tenancyContract.findMany({
      where: { organizationId, tenantId: id },
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        organizationId: true,
        tenantId: true,
        unitId: true,
        ownerId: true,
        contractNo: true,
        version: true,
        status: true,
        contractStart: true,
        contractEnd: true,
        graceStart: true,
        rentAmount: true,
        rentInWords: true,
        numberOfCheques: true,
        securityDeposit: true,
        bookingAmount: true,
        contractType: true,
        purpose: true,
        ejariFee: true,
        municipalityFee: true,
        commissionFee: true,
        signatureToken: true,
        generatedAt: true,
        sentAt: true,
        signedByTenantAt: true,
        signedByLandlordAt: true,
        effectiveAt: true,
        terminatedAt: true,
        terminationReason: true,
        signedFilePath: true,
        signedFileName: true,
        signedFileSize: true,
        uploadedAt: true,
        renewalOfId: true,
        reason: true,
        notes: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    return NextResponse.json({ contracts })
  } catch (error) {
    console.error('GET /api/tenants/[id]/tenancy-contracts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const organizationId = session.user.organizationId
    const { id } = await params
    const body = await request.json().catch(() => ({} as Record<string, unknown>))

    const tenant = await prisma.tenant.findFirst({
      where: { id, organizationId },
    })
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const unitId = String(body.unitId || '')
    if (!unitId) return NextResponse.json({ error: 'unitId required' }, { status: 400 })
    const unit = await prisma.unit.findFirst({ where: { id: unitId, organizationId } })
    if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 })

    const ownerId = body.ownerId ? String(body.ownerId) : ''
    let owner: Awaited<ReturnType<typeof prisma.propertyOwner.findFirst>> = null
    if (ownerId) {
      owner = await prisma.propertyOwner.findFirst({ where: { id: ownerId, organizationId } })
      if (!owner) return NextResponse.json({ error: 'Owner not found' }, { status: 404 })
    }

    const contractType = String(body.contractType || 'Residential')
    const isResidential = contractType.toLowerCase() === 'residential'
    const contractStart = String(body.contractStart || '')
    const contractEnd = String(body.contractEnd || '')
    if (!contractStart || !contractEnd) {
      return NextResponse.json({ error: 'contractStart and contractEnd required' }, { status: 400 })
    }

    const rentAmount = Number(body.rentAmount || 0)
    const rentInWords = String(body.rentInWords || '')
    const numberOfCheques = Number(body.numberOfCheques || 4)
    const securityDeposit = Number(
      body.securityDeposit != null ? body.securityDeposit : (isResidential ? 0.05 : 0.1) * rentAmount
    )
    const bookingAmount = Number(body.bookingAmount || 0)
    const purpose = String(body.purpose || (isResidential ? 'Family residence' : 'Commercial use'))
    const ejariFee = Number(body.ejariFee != null ? body.ejariFee : 250)
    const municipalityFee = Number(body.municipalityFee != null ? body.municipalityFee : 210)
    const commissionFee = Number(
      body.commissionFee != null
        ? body.commissionFee
        : Math.max(isResidential ? 0.05 * rentAmount : 0.1 * rentAmount, isResidential ? 1050 : 1050)
    )
    const reason = String(body.reason || 'Initial')

    const graceDays = isResidential ? 20 : 30
    const graceStart = addDays(contractStart, graceDays)

    // Determine version
    const latest = await prisma.tenancyContract.findFirst({
      where: { organizationId, tenantId: id },
      orderBy: { version: 'desc' },
      select: { version: true },
    })
    const version = (latest?.version || 0) + 1

    const contractNo = await generateContractNo(organizationId, new Date().getFullYear())
    const signatureToken = crypto.randomBytes(24).toString('hex')

    // Build snapshot HTML
    const baseUrl = process.env.NEXTAUTH_URL || ''
    const orgName = (
      await prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } })
    )?.name || 'Alwaan'

    const tempContract: TenancyContractRecord = {
      id: 'pending',
      contractNo,
      version,
      status: 'Draft',
      contractStart,
      contractEnd,
      graceStart,
      rentAmount,
      rentInWords,
      numberOfCheques,
      securityDeposit,
      bookingAmount,
      contractType,
      purpose,
      ejariFee,
      municipalityFee,
      commissionFee,
      signatureToken,
    }

    // Keep legacy builder call available but prefer the official DLD format
    // so the generated contract matches the Unified Tenancy Contract layout.
    void buildTenancyContractHTML
    void ({} as TenantRecord)
    void ({} as UnitRecord)
    void ({} as OwnerRecord)
    void orgName
    void baseUrl

    const contractValue = rentAmount // annual rent is the contract value for a 1-year lease
    const htmlBody = buildDldTenancyContractHTML({
      tenant: {
        name: tenant.name,
        email: tenant.email,
        phone: tenant.phone,
        emiratesId: tenant.emiratesId,
        occupants: tenant.familySize,
        isCompany: tenant.isCompany,
        companyName: tenant.companyName,
        companyTradeLicense: tenant.companyTradeLicense,
      },
      unit: {
        unitNo: unit.unitNo,
        unitType: unit.unitType,
        currentRent: rentAmount,
        contractStart,
        contractEnd,
      },
      owner: {
        ownerName: owner?.ownerName || '',
        buildingName: owner?.buildingName || '',
        area: owner?.area || '',
        plotNo: owner?.plotNo || '',
        makaniNo: owner?.makaniNo || '',
        dewaPremiseNo: '',
      },
      contractValue,
      securityDeposit,
      numCheques: numberOfCheques,
      date: new Date().toISOString().slice(0, 10),
      omitParties: true,
    }, baseUrl)

    void tempContract

    const created = await prisma.tenancyContract.create({
      data: {
        organizationId,
        tenantId: id,
        unitId,
        ownerId: ownerId || null,
        contractNo,
        version,
        status: 'Draft',
        contractStart,
        contractEnd,
        graceStart,
        rentAmount,
        rentInWords,
        numberOfCheques,
        securityDeposit,
        bookingAmount,
        contractType,
        purpose,
        ejariFee,
        municipalityFee,
        commissionFee,
        htmlBody,
        signatureToken,
        reason,
        createdBy: session.user.name || '',
      },
    })

    // Mark previous Active contracts for same tenant + unit as Renewed
    await prisma.tenancyContract.updateMany({
      where: {
        organizationId,
        tenantId: id,
        unitId,
        status: 'Active',
        id: { not: created.id },
      },
      data: { status: 'Renewed' },
    })

    await logActivity(
      organizationId,
      session.user.name,
      'Generated Tenancy Contract',
      `${created.contractNo} v${created.version} – ${tenant.name} – Unit ${unit.unitNo} – ${reason}`
    )
    await createNotification(
      organizationId,
      'staff',
      '',
      'New Tenancy Contract',
      `${created.contractNo} v${created.version} for ${tenant.name}`,
      'system'
    )

    // Seed empty Cheque records immediately so the Payment Plan UI has tabs
    // to fill in BEFORE activation. We only seed if no cheques exist for this
    // tenant yet (avoids dupes when the activation route also tries to seed).
    const existingChequeCount = await prisma.cheque.count({
      where: { organizationId, tenantId: id },
    })
    if (existingChequeCount === 0 && numberOfCheques > 0) {
      const perCheque = rentAmount
        ? Math.round((rentAmount / numberOfCheques) * 100) / 100
        : 0
      await prisma.cheque.createMany({
        data: Array.from({ length: numberOfCheques }, (_, i) => ({
          organizationId,
          tenantId: id,
          unitId: unitId || null,
          sequenceNo: i + 1,
          totalCheques: numberOfCheques,
          status: 'Pending',
          paymentType: 'Rent',
          amount: perCheque,
          chequeNo: '',
          chequeDate: '',
          bankName: '',
        })),
      })
    }

    // Sync the unit so dashboards (renewals, occupancy) reflect the contract.
    await prisma.unit.update({
      where: { id: unitId },
      data: {
        tenantId: id,
        status: 'Occupied',
        contractStart,
        contractEnd,
        currentRent: rentAmount,
      },
    }).catch((e) => console.warn('Unit sync failed:', e))

    let finalContract = created
    if (tenant.email) {
      const tpl = tenancyContractGeneratedTemplate(
        tenant as never,
        created as never,
        (owner as never) || null,
        baseUrl
      )
      await sendEmail({
        organizationId,
        to: tenant.email,
        toName: tenant.name,
        subject: tpl.subject,
        html: tpl.html,
        template: 'tenancy_contract_generated',
        triggeredBy: session.user.name,
        refType: 'tenancy_contract',
        refId: created.id,
      })
      // Mark contract as Sent now that the signature email has gone out.
      // This flips the PM portal into the "Waiting for tenant" locked state.
      finalContract = await prisma.tenancyContract.update({
        where: { id: created.id },
        data: { status: 'Sent', sentAt: new Date() },
      })
    }

    // Tenant should not be marked Active until they sign + we activate.
    // Park them as "Pending" so the portal badge reflects reality.
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { status: 'Pending' },
    }).catch(() => {})

    const { htmlBody: _omit, ...safe } = finalContract
    return NextResponse.json({ message: 'Contract created', contract: safe }, { status: 201 })
  } catch (error) {
    console.error('POST /api/tenants/[id]/tenancy-contracts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
