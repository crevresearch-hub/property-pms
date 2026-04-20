import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { normalizeUnitType } from '@/lib/unit-type-mapper'
import { logActivity } from '@/lib/activity'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const organizationId = session.user.organizationId
    const units = await prisma.unit.findMany({
      where: { organizationId },
      select: { id: true, unitType: true },
    })

    let updated = 0
    const changes: Record<string, { from: string; to: string; count: number }> = {}

    for (const u of units) {
      const normalized = normalizeUnitType(u.unitType)
      if (normalized && normalized !== u.unitType) {
        await prisma.unit.update({ where: { id: u.id }, data: { unitType: normalized } })
        updated++
        const key = `${u.unitType}→${normalized}`
        if (!changes[key]) changes[key] = { from: u.unitType, to: normalized, count: 0 }
        changes[key].count++
      }
    }

    await logActivity(
      organizationId,
      session.user.name,
      'Normalize Unit Types',
      `Updated ${updated} units`
    )

    return NextResponse.json({
      totalUnits: units.length,
      updated,
      changes: Object.values(changes),
    })
  } catch (error) {
    console.error('POST /api/admin/normalize-unit-types error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
