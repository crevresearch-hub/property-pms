import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

/**
 * Vacating process is persisted in tenant.notes as a JSON block wrapped in
 * markers so free-text notes can coexist. Format:
 *
 *   <!--VACATING::{...json...}--\>
 *
 * The JSON contains type, noticeDate, vacateDate, reason, penaltyAmount,
 * refundAmount, and a checklist of boolean items.
 */

const START = '<!--VACATING::'
const END = '-->'

export interface VacatingData {
  type: string // "Normal at expiry" | "Early termination" | "Non-renewal"
  noticeDate: string
  vacateDate: string
  reason: string
  penaltyAmount: number
  refundAmount: number
  checklist: Record<string, boolean>
  closedAt?: string
  createdAt: string
  updatedAt: string
}

const DEFAULT_CHECKLIST: Record<string, boolean> = {
  finalInspection: false,
  dewaFinalBill: false,
  damageAssessment: false,
  fmrSigned: false,
  keysReturned: false,
  depositCalculated: false,
  refundIssued: false,
  ejariCancelled: false,
  unitMarkedVacant: false,
}

function parseVacating(notes: string): { data: VacatingData | null; rest: string } {
  const s = notes.indexOf(START)
  if (s < 0) return { data: null, rest: notes }
  const e = notes.indexOf(END, s)
  if (e < 0) return { data: null, rest: notes }
  const jsonStr = notes.slice(s + START.length, e)
  try {
    const data = JSON.parse(jsonStr) as VacatingData
    const rest = (notes.slice(0, s) + notes.slice(e + END.length)).trim()
    return { data, rest }
  } catch {
    return { data: null, rest: notes }
  }
}

function serialize(rest: string, data: VacatingData): string {
  const block = `${START}${JSON.stringify(data)}${END}`
  return (rest ? rest + '\n\n' : '') + block
}

function calcPenalty(type: string, contractType: string, rentAmount: number): number {
  if (type !== 'Early termination') return 0
  // Residential: 2 months, Commercial: 3 months
  const months = contractType.toLowerCase() === 'commercial' ? 3 : 2
  return Math.round((rentAmount / 12) * months)
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const tenant = await prisma.tenant.findFirst({
      where: { id, organizationId: session.user.organizationId },
    })
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { data } = parseVacating(tenant.notes || '')
    return NextResponse.json({ vacating: data })
  } catch (error) {
    console.error('GET /api/tenants/[id]/vacating error:', error)
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
      include: {
        units: { select: { id: true, currentRent: true, unitType: true } },
        tenancyContracts: {
          where: { status: 'Active' },
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    })
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { rest } = parseVacating(tenant.notes || '')
    const now = new Date().toISOString()

    const activeContract = tenant.tenancyContracts[0]
    const contractType = activeContract?.contractType || 'Residential'
    const rentAmount = activeContract?.rentAmount || tenant.units[0]?.currentRent || 0
    const securityDeposit = activeContract?.securityDeposit || 0

    const type = String(body.type || 'Normal at expiry')
    const penaltyAmount = calcPenalty(type, contractType, rentAmount)

    const data: VacatingData = {
      type,
      noticeDate: String(body.noticeDate || ''),
      vacateDate: String(body.vacateDate || ''),
      reason: String(body.reason || ''),
      penaltyAmount,
      refundAmount: Math.max(0, securityDeposit - penaltyAmount),
      checklist: { ...DEFAULT_CHECKLIST },
      createdAt: now,
      updatedAt: now,
    }

    await prisma.tenant.update({
      where: { id },
      data: {
        notes: serialize(rest, data),
        status: 'Vacating',
      },
    })

    await logActivity(
      organizationId,
      session.user.name,
      'Initiated Vacating',
      `${tenant.name} — ${type} — vacate ${data.vacateDate}`
    )

    return NextResponse.json({ vacating: data }, { status: 201 })
  } catch (error) {
    console.error('POST /api/tenants/[id]/vacating error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH updates checklist items (and optionally closes the process).
 * Body: { checklist?: {key:boolean}, close?: boolean }
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
    const body = (await request.json().catch(() => ({}))) as {
      checklist?: Record<string, boolean>
      close?: boolean
    }

    const tenant = await prisma.tenant.findFirst({
      where: { id, organizationId },
      include: { units: { select: { id: true } } },
    })
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { data, rest } = parseVacating(tenant.notes || '')
    if (!data) return NextResponse.json({ error: 'No vacating process initiated' }, { status: 404 })

    if (body.checklist) {
      data.checklist = { ...data.checklist, ...body.checklist }
    }
    data.updatedAt = new Date().toISOString()

    if (body.close) {
      data.closedAt = new Date().toISOString()

      // Unlink units and mark vacant
      if (tenant.units.length > 0) {
        await prisma.unit.updateMany({
          where: { tenantId: id, organizationId },
          data: { tenantId: null, status: 'Vacant', contractStart: '', contractEnd: '' },
        })
      }

      await prisma.tenant.update({
        where: { id },
        data: {
          notes: serialize(rest, data),
          status: 'Vacated',
        },
      })

      // Terminate any active contract
      await prisma.tenancyContract.updateMany({
        where: { tenantId: id, organizationId, status: 'Active' },
        data: {
          status: 'Terminated',
          terminatedAt: new Date(),
          terminationReason: data.reason || data.type,
        },
      })

      await logActivity(
        organizationId,
        session.user.name,
        'Completed Vacating',
        `${tenant.name} — ${data.type}`
      )
    } else {
      await prisma.tenant.update({
        where: { id },
        data: { notes: serialize(rest, data) },
      })
    }

    return NextResponse.json({ vacating: data })
  } catch (error) {
    console.error('PATCH /api/tenants/[id]/vacating error:', error)
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

    const tenant = await prisma.tenant.findFirst({
      where: { id, organizationId },
    })
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { rest } = parseVacating(tenant.notes || '')
    await prisma.tenant.update({
      where: { id },
      data: {
        notes: rest,
        status: tenant.status === 'Vacating' ? 'Active' : tenant.status,
      },
    })

    return NextResponse.json({ message: 'Vacating cancelled' })
  } catch (error) {
    console.error('DELETE /api/tenants/[id]/vacating error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
