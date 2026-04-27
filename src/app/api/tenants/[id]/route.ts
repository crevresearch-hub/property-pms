import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

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

    const tenant = await prisma.tenant.findFirst({
      where: { id, organizationId },
      include: {
        units: {
          select: {
            id: true,
            unitNo: true,
            unitType: true,
            status: true,
            currentRent: true,
            contractStart: true,
            contractEnd: true,
          },
        },
        invoices: {
          orderBy: { createdAt: 'desc' },
          include: {
            unit: {
              select: { id: true, unitNo: true },
            },
          },
        },
        documents: {
          orderBy: { uploadedAt: 'desc' },
        },
        maintenanceTickets: {
          orderBy: { submittedAt: 'desc' },
          include: {
            unit: {
              select: { id: true, unitNo: true },
            },
          },
        },
      },
    })

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    return NextResponse.json(tenant)
  } catch (error) {
    console.error('GET /api/tenants/[id] error:', error)
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

    const existing = await prisma.tenant.findFirst({
      where: { id, organizationId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    // Lock tenant edits when the latest contract is awaiting tenant signature
    // or has gone Active. Internal-only fields used by the signing/OCR flows
    // are still allowed (so the public sign endpoint can patch the tenant).
    const ALWAYS_ALLOWED = new Set([
      'familySize', 'emergencyContactName', 'emergencyContactPhone',
    ])
    const incomingKeys = Object.keys(body || {})
    const hasUserEdit = incomingKeys.some((k) => !ALWAYS_ALLOWED.has(k))
    if (hasUserEdit) {
      const latest = await prisma.tenancyContract.findFirst({
        where: { organizationId, tenantId: id },
        orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
        select: { status: true, signedByTenantAt: true },
      })
      if (latest) {
        if (latest.status === 'Sent' && !latest.signedByTenantAt) {
          return NextResponse.json(
            { error: 'Tenant record is locked while waiting for tenant to sign the contract.' },
            { status: 423 }
          )
        }
        if (latest.status === 'Active') {
          return NextResponse.json(
            { error: 'Tenant record is locked because the contract is Active. Issue an amendment to make changes.' },
            { status: 423 }
          )
        }
      }
    }

    const tenant = await prisma.tenant.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.phone !== undefined && { phone: body.phone }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.emiratesId !== undefined && { emiratesId: body.emiratesId }),
        ...(body.passportNo !== undefined && { passportNo: body.passportNo }),
        ...(body.nationality !== undefined && { nationality: body.nationality }),
        ...(body.emergencyContactName !== undefined && { emergencyContactName: body.emergencyContactName }),
        ...(body.emergencyContactPhone !== undefined && { emergencyContactPhone: body.emergencyContactPhone }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.visaNo !== undefined && { visaNo: body.visaNo }),
        ...(body.visaExpiry !== undefined && { visaExpiry: body.visaExpiry }),
        ...(body.emiratesIdExpiry !== undefined && { emiratesIdExpiry: body.emiratesIdExpiry }),
        ...(body.passportExpiry !== undefined && { passportExpiry: body.passportExpiry }),
        ...(body.occupation !== undefined && { occupation: body.occupation }),
        ...(body.employer !== undefined && { employer: body.employer }),
        ...(body.familySize !== undefined && { familySize: Number(body.familySize) }),
        ...(body.isCompany !== undefined && { isCompany: Boolean(body.isCompany) }),
        ...(body.companyName !== undefined && { companyName: body.companyName }),
        ...(body.companyTradeLicense !== undefined && { companyTradeLicense: body.companyTradeLicense }),
        ...(body.companyTradeLicenseExpiry !== undefined && { companyTradeLicenseExpiry: body.companyTradeLicenseExpiry }),
        ...(body.signatoryName !== undefined && { signatoryName: body.signatoryName }),
        ...(body.signatoryTitle !== undefined && { signatoryTitle: body.signatoryTitle }),
      },
      include: {
        units: {
          select: { id: true, unitNo: true },
        },
      },
    })

    await logActivity(organizationId, session.user.name, 'Updated Tenant', `Tenant ${tenant.name} updated`)

    return NextResponse.json(tenant)
  } catch (error) {
    console.error('PUT /api/tenants/[id] error:', error)
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
    // Hard-delete is reserved for the developer (dev-login synthetic user).
    // Org admins / staff use the Terminate workflow instead. Defense-in-depth
    // mirroring the UI gate on the Tenants list page.
    const isDeveloper = session.user.id === 'admin-dev' || session.user.email === 'admin@cre.ae'
    if (!isDeveloper) {
      return NextResponse.json({ error: 'Only the developer can delete tenants' }, { status: 403 })
    }

    const organizationId = session.user.organizationId
    const { id } = await params

    const tenant = await prisma.tenant.findFirst({
      where: { id, organizationId },
      include: { units: { select: { id: true } } },
    })

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    // Unlink tenant from all units first
    if (tenant.units.length > 0) {
      await prisma.unit.updateMany({
        where: {
          tenantId: id,
          organizationId,
        },
        data: {
          tenantId: null,
          status: 'Vacant',
        },
      })
    }

    await prisma.tenant.delete({
      where: { id },
    })

    await logActivity(organizationId, session.user.name, 'Deleted Tenant', `Tenant ${tenant.name} deleted`)

    return NextResponse.json({ message: 'Tenant deleted successfully' })
  } catch (error) {
    console.error('DELETE /api/tenants/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
