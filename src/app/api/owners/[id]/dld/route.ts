import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

export const runtime = 'nodejs'

const DLD_STATUSES = new Set(['Not Registered', 'In Progress', 'Registered', 'Rejected'])
const DLD_CONTRACT_TYPES = new Set(['PM Building', 'PM Unit', 'Lease & Sublease'])

function dldFields(owner: {
  dldContractNo: string
  dldStatus: string
  dldContractType: string
  dldSubmittedAt: Date | null
  dldRegisteredAt: Date | null
  dldPdfPath: string
  dldPdfName: string
  dldPdfSize: number
  dldPdfUploadedAt: Date | null
  dldNotes: string
}) {
  return {
    dldContractNo: owner.dldContractNo,
    dldStatus: owner.dldStatus,
    dldContractType: owner.dldContractType,
    dldSubmittedAt: owner.dldSubmittedAt,
    dldRegisteredAt: owner.dldRegisteredAt,
    dldPdfPath: owner.dldPdfPath,
    dldPdfName: owner.dldPdfName,
    dldPdfSize: owner.dldPdfSize,
    dldPdfUploadedAt: owner.dldPdfUploadedAt,
    dldNotes: owner.dldNotes,
  }
}

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
      select: {
        id: true,
        ownerName: true,
        buildingName: true,
        dldContractNo: true,
        dldStatus: true,
        dldContractType: true,
        dldSubmittedAt: true,
        dldRegisteredAt: true,
        dldPdfPath: true,
        dldPdfName: true,
        dldPdfSize: true,
        dldPdfUploadedAt: true,
        dldNotes: true,
      },
    })
    if (!owner) {
      return NextResponse.json({ error: 'Owner not found' }, { status: 404 })
    }

    return NextResponse.json(dldFields(owner))
  } catch (error) {
    console.error('GET /api/owners/[id]/dld error:', error)
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

    const existing = await prisma.propertyOwner.findFirst({
      where: { id, organizationId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Owner not found' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}

    if (typeof body.dldContractNo === 'string') {
      data.dldContractNo = body.dldContractNo.trim()
    }
    if (typeof body.dldStatus === 'string') {
      if (!DLD_STATUSES.has(body.dldStatus)) {
        return NextResponse.json(
          { error: `Invalid dldStatus: ${body.dldStatus}` },
          { status: 400 }
        )
      }
      data.dldStatus = body.dldStatus
    }
    if (typeof body.dldContractType === 'string') {
      if (!DLD_CONTRACT_TYPES.has(body.dldContractType)) {
        return NextResponse.json(
          { error: `Invalid dldContractType: ${body.dldContractType}` },
          { status: 400 }
        )
      }
      data.dldContractType = body.dldContractType
    }
    if (typeof body.dldNotes === 'string') {
      data.dldNotes = body.dldNotes
    }
    if (body.dldSubmittedAt !== undefined) {
      data.dldSubmittedAt = body.dldSubmittedAt ? new Date(body.dldSubmittedAt) : null
    }
    if (body.dldRegisteredAt !== undefined) {
      data.dldRegisteredAt = body.dldRegisteredAt ? new Date(body.dldRegisteredAt) : null
    }

    // Convenience: auto-set submittedAt when moving to "In Progress" if not already
    if (
      data.dldStatus === 'In Progress' &&
      !existing.dldSubmittedAt &&
      body.dldSubmittedAt === undefined
    ) {
      data.dldSubmittedAt = new Date()
    }
    // Convenience: auto-set registeredAt when moving to "Registered" if not already
    if (
      data.dldStatus === 'Registered' &&
      !existing.dldRegisteredAt &&
      body.dldRegisteredAt === undefined
    ) {
      data.dldRegisteredAt = new Date()
    }

    const updated = await prisma.propertyOwner.update({
      where: { id },
      data,
      select: {
        id: true,
        ownerName: true,
        buildingName: true,
        dldContractNo: true,
        dldStatus: true,
        dldContractType: true,
        dldSubmittedAt: true,
        dldRegisteredAt: true,
        dldPdfPath: true,
        dldPdfName: true,
        dldPdfSize: true,
        dldPdfUploadedAt: true,
        dldNotes: true,
      },
    })

    if (data.dldStatus && data.dldStatus !== existing.dldStatus) {
      await logActivity(
        organizationId,
        session.user.name,
        'DLD Status Changed',
        `${existing.ownerName} (${existing.buildingName}): ${existing.dldStatus} -> ${updated.dldStatus}${
          updated.dldContractNo ? ` [DLD #${updated.dldContractNo}]` : ''
        }`
      )
    } else if (
      data.dldContractNo !== undefined &&
      data.dldContractNo !== existing.dldContractNo
    ) {
      await logActivity(
        organizationId,
        session.user.name,
        'DLD Contract No Updated',
        `${existing.ownerName} (${existing.buildingName}): ${updated.dldContractNo || '(cleared)'}`
      )
    }

    return NextResponse.json(dldFields(updated))
  } catch (error) {
    console.error('PUT /api/owners/[id]/dld error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
