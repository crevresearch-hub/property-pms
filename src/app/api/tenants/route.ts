import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId

    const tenants = await prisma.tenant.findMany({
      where: { organizationId },
      include: {
        units: {
          select: {
            id: true,
            unitNo: true,
            status: true,
            currentRent: true,
          },
        },
        documents: {
          select: {
            id: true,
            docType: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    // Pull cheque counts so the badge reflects records in the Cheque table,
    // not just the legacy "Cheques" document upload.
    const chequeRows = await prisma.cheque.groupBy({
      by: ['tenantId'],
      where: { organizationId, tenantId: { in: tenants.map((t) => t.id) } },
      _count: { _all: true },
    })
    const chequeCountByTenant = new Map(
      chequeRows.map((r) => [r.tenantId, r._count._all])
    )

    // Add document status flags
    const tenantsWithFlags = tenants.map((tenant: typeof tenants[number]) => {
      const docTypes = tenant.documents.map((d: { docType: string }) => d.docType.toLowerCase())
      const hasChequeImage = docTypes.some((t) => t.startsWith('cheque-') || t === 'upfront-cheque')
      const hasChequeRow = (chequeCountByTenant.get(tenant.id) || 0) > 0
      return {
        ...tenant,
        has_ejari: docTypes.includes('ejari'),
        has_cheque:
          hasChequeRow ||
          hasChequeImage ||
          docTypes.includes('cheque') ||
          docTypes.includes('cheques'),
        has_eid: docTypes.includes('emirates id') || docTypes.includes('eid') || docTypes.includes('emirates_id'),
      }
    })

    return NextResponse.json(tenantsWithFlags)
  } catch (error) {
    console.error('GET /api/tenants error:', error)
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

    const {
      name, phone, email, emiratesId, passportNo, nationality,
      emergencyContactName, emergencyContactPhone, status, notes, unitId,
      visaNo, visaExpiry, emiratesIdExpiry, passportExpiry,
      occupation, employer, familySize,
      isCompany, companyName, companyTradeLicense, companyTradeLicenseExpiry,
      signatoryName, signatoryTitle,
    } = body

    if (!name) {
      return NextResponse.json({ error: 'Tenant name is required' }, { status: 400 })
    }

    const tenant = await prisma.tenant.create({
      data: {
        organizationId,
        name,
        phone: phone || '',
        email: email || '',
        emiratesId: emiratesId || '',
        passportNo: passportNo || '',
        nationality: nationality || '',
        emergencyContactName: emergencyContactName || '',
        emergencyContactPhone: emergencyContactPhone || '',
        status: status || 'Active',
        notes: notes || '',
        visaNo: visaNo || '',
        visaExpiry: visaExpiry || '',
        emiratesIdExpiry: emiratesIdExpiry || '',
        passportExpiry: passportExpiry || '',
        occupation: occupation || '',
        employer: employer || '',
        familySize: familySize != null ? Number(familySize) : 1,
        isCompany: Boolean(isCompany),
        companyName: companyName || '',
        companyTradeLicense: companyTradeLicense || '',
        companyTradeLicenseExpiry: companyTradeLicenseExpiry || '',
        signatoryName: signatoryName || '',
        signatoryTitle: signatoryTitle || '',
      },
    })

    // Optionally link to a unit
    if (unitId) {
      const unit = await prisma.unit.findFirst({
        where: { id: unitId, organizationId },
      })

      if (unit) {
        await prisma.unit.update({
          where: { id: unitId },
          data: {
            tenantId: tenant.id,
            status: 'Occupied',
          },
        })
      }
    }

    // Fetch the complete tenant with relations
    const fullTenant = await prisma.tenant.findUnique({
      where: { id: tenant.id },
      include: {
        units: {
          select: { id: true, unitNo: true, status: true },
        },
      },
    })

    await logActivity(organizationId, session.user.name, 'Created Tenant', `Tenant ${name} created`)

    return NextResponse.json(fullTenant, { status: 201 })
  } catch (error) {
    console.error('POST /api/tenants error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
