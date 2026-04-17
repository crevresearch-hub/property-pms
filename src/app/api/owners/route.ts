import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
// Email removed per user request - too many emails. Only: contract_sent, admin_owner_signed, final_package.

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId

    const owners = await prisma.propertyOwner.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    })

    // Attach latest contract status per owner for dashboard KPIs / workflow labels.
    const ownerIds = owners.map((o) => o.id)
    const latestContracts = ownerIds.length
      ? await prisma.ownerContract.findMany({
          where: { organizationId, ownerId: { in: ownerIds } },
          orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
          select: { ownerId: true, status: true, version: true, createdAt: true },
        })
      : []
    const latestByOwner = new Map<string, string>()
    for (const c of latestContracts) {
      if (!latestByOwner.has(c.ownerId)) {
        latestByOwner.set(c.ownerId, c.status)
      }
    }

    const enriched = owners.map((o) => ({
      ...o,
      latestContractStatus: latestByOwner.get(o.id) || null,
    }))

    return NextResponse.json(enriched)
  } catch (error) {
    console.error('GET /api/owners error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    const body = await request.json()

    const { ownerName, email, buildingName } = body

    if (!ownerName || !email || !buildingName) {
      return NextResponse.json(
        { error: 'ownerName, email, and buildingName are required' },
        { status: 400 }
      )
    }

    // Sanitize/normalize numeric and boolean fields
    const data: Record<string, unknown> = {
      organizationId,
      ownerName,
      email,
      buildingName,
      ownerType: body.ownerType ?? 'Individual',
      emiratesId: body.emiratesId ?? '',
      passportNo: body.passportNo ?? '',
      nationality: body.nationality ?? '',
      phone: body.phone ?? '',
      alternatePhone: body.alternatePhone ?? '',
      address: body.address ?? '',
      iban: body.iban ?? '',
      bankName: body.bankName ?? '',
      tradeLicense: body.tradeLicense ?? '',
      buildingType: body.buildingType ?? 'Residential',
      emirate: body.emirate ?? 'Dubai',
      area: body.area ?? '',
      plotNo: body.plotNo ?? '',
      makaniNo: body.makaniNo ?? '',
      titleDeedNo: body.titleDeedNo ?? '',
      totalUnits: Number(body.totalUnits) || 0,
      totalFloors: Number(body.totalFloors) || 0,
      parkingSpaces: Number(body.parkingSpaces) || 0,
      yearBuilt: body.yearBuilt ?? '',
      buildingDescription: body.buildingDescription ?? '',
      serviceType: body.serviceType ?? 'Full Property Management',
      servicesIncluded: body.servicesIncluded ?? '',
      leasingCommissionRes: Number(body.leasingCommissionRes ?? 5),
      leasingCommissionCom: Number(body.leasingCommissionCom ?? 10),
      managementFee: Number(body.managementFee ?? 5),
      renewalFeeRes: Number(body.renewalFeeRes ?? 850),
      renewalFeeCom: Number(body.renewalFeeCom ?? 1500),
      maintenanceMarkup: Number(body.maintenanceMarkup ?? 15),
      customCommissionNotes: body.customCommissionNotes ?? '',
      contractStartDate: body.contractStartDate ?? '',
      contractEndDate: body.contractEndDate ?? '',
      contractTerm: body.contractTerm ?? '1 year',
      noticePeriodDays: Number(body.noticePeriodDays ?? 60),
      autoRenew: body.autoRenew !== undefined ? Boolean(body.autoRenew) : true,
      exclusiveMandate: body.exclusiveMandate !== undefined ? Boolean(body.exclusiveMandate) : true,
      paymentFrequency: body.paymentFrequency ?? 'Monthly',
      reportingFrequency: body.reportingFrequency ?? 'Monthly',
      approvalThreshold: Number(body.approvalThreshold ?? 5000),
      stage: 'Lead',
      notes: body.notes ?? '',
    }

    const owner = await prisma.propertyOwner.create({ data: data as never })

    await logActivity(
      organizationId,
      session.user.name,
      'Created Property Owner',
      `${owner.ownerName} - ${owner.buildingName}`
    )

    // Email removed per user request - too many emails. Only: contract_sent, admin_owner_signed, final_package.

    return NextResponse.json(owner, { status: 201 })
  } catch (error) {
    console.error('POST /api/owners error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
