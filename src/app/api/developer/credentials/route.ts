import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { cookies } from 'next/headers'

async function devGate(): Promise<boolean> {
  const c = await cookies()
  return c.get('dev_unlocked')?.value === '1'
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await devGate())) return NextResponse.json({ error: 'Developer access required' }, { status: 403 })

  const organizationId = session.user.organizationId
  const [staff, owners, tenants] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId },
      select: { id: true, email: true, name: true, role: true, password: true },
    }),
    prisma.propertyOwner.findMany({
      where: { organizationId },
      select: { id: true, email: true, ownerName: true, buildingName: true, passwordHash: true },
    }),
    prisma.tenant.findMany({
      where: { organizationId },
      select: { id: true, email: true, name: true, status: true, phone: true, passwordHash: true, units: { select: { unitNo: true } } },
    }),
  ])

  return NextResponse.json({
    staff: staff.map((u) => ({
      id: u.id, email: u.email, name: u.name, role: u.role, hasPassword: !!u.password,
    })),
    owners: owners.map((o) => ({
      id: o.id, email: o.email, name: o.ownerName, building: o.buildingName, hasPassword: !!o.passwordHash,
    })),
    tenants: tenants.map((t) => ({
      id: t.id, email: t.email, name: t.name, status: t.status, phone: t.phone,
      unitNo: t.units[0]?.unitNo || '',
      hasPassword: !!t.passwordHash,
    })),
  })
}

// POST: reset password for a given account
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await devGate())) return NextResponse.json({ error: 'Developer access required' }, { status: 403 })

  const { type, id, password } = await request.json()
  if (!type || !id || !password || password.length < 6) {
    return NextResponse.json({ error: 'Missing fields or password too short' }, { status: 400 })
  }
  const { hash } = await import('bcryptjs')
  const h = await hash(password, 10)
  const organizationId = session.user.organizationId

  try {
    if (type === 'staff') {
      await prisma.user.updateMany({ where: { id, organizationId }, data: { password: h } })
    } else if (type === 'owner') {
      await prisma.propertyOwner.updateMany({ where: { id, organizationId }, data: { passwordHash: h } })
    } else if (type === 'tenant') {
      await prisma.tenant.updateMany({ where: { id, organizationId }, data: { passwordHash: h } })
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}
