import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import {
  getDefaultContractContent,
  mergeWithDefaults,
  type ContractContent,
} from '@/lib/contract-clauses-default'

async function findOwner(organizationId: string, id: string) {
  return prisma.propertyOwner.findFirst({
    where: { id, organizationId },
    select: { id: true, ownerName: true, buildingName: true, contractClausesJson: true },
  })
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
    const { id } = await params
    const owner = await findOwner(session.user.organizationId, id)
    if (!owner) {
      return NextResponse.json({ error: 'Owner not found' }, { status: 404 })
    }

    const raw = owner.contractClausesJson || ''
    if (raw.trim()) {
      try {
        const parsed = JSON.parse(raw) as Partial<ContractContent>
        return NextResponse.json({
          content: mergeWithDefaults(parsed),
          isCustom: true,
        })
      } catch (err) {
        console.error('contract-content GET parse error:', err)
        // fall through to default
      }
    }

    return NextResponse.json({
      content: getDefaultContractContent(),
      isCustom: false,
    })
  } catch (err) {
    console.error('GET /api/owners/[id]/contract-content error:', err)
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

    const owner = await findOwner(organizationId, id)
    if (!owner) {
      return NextResponse.json({ error: 'Owner not found' }, { status: 404 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Body must be a ContractContent object' }, { status: 400 })
    }

    // Normalize & validate by merging with defaults (ensures shape is safe)
    const normalized = mergeWithDefaults(body as Partial<ContractContent>)

    await prisma.propertyOwner.update({
      where: { id },
      data: { contractClausesJson: JSON.stringify(normalized) },
    })

    await logActivity(
      organizationId,
      session.user.name,
      'Edited PM Contract Text',
      `${owner.ownerName} – ${owner.buildingName}`
    )

    return NextResponse.json({
      message: 'Contract content saved',
      content: normalized,
      isCustom: true,
    })
  } catch (err) {
    console.error('PUT /api/owners/[id]/contract-content error:', err)
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
    const organizationId = session.user.organizationId
    const { id } = await params

    const owner = await findOwner(organizationId, id)
    if (!owner) {
      return NextResponse.json({ error: 'Owner not found' }, { status: 404 })
    }

    await prisma.propertyOwner.update({
      where: { id },
      data: { contractClausesJson: '' },
    })

    await logActivity(
      organizationId,
      session.user.name,
      'Reset PM Contract Text to Default',
      `${owner.ownerName} – ${owner.buildingName}`
    )

    return NextResponse.json({
      message: 'Reset to default',
      content: getDefaultContractContent(),
      isCustom: false,
    })
  } catch (err) {
    console.error('DELETE /api/owners/[id]/contract-content error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
