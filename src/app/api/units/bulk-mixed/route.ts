import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

interface FloorTypeCount {
  unitType: string
  count: number
  rent?: number
}

interface FloorConfig {
  floor: number
  types: FloorTypeCount[]
}

/**
 * Bulk create units with per-floor type breakdown.
 * Body: {
 *   startFloor: number,          // e.g. 1
 *   floors: FloorConfig[],       // per-floor type breakdown
 *   numbering?: 'floor-prefix' | 'sequential',  // default 'floor-prefix'
 *   prefix?: string,             // optional like 'A-'
 *   skipExisting?: boolean,      // default true
 * }
 *
 * Example:
 *   floors=[
 *     { floor: 1, types: [{unitType:'3 BHK',count:18,rent:120000}, {unitType:'Studio',count:9,rent:40000}] },
 *     { floor: 2, types: [{unitType:'2 BHK',count:12}] }
 *   ]
 * Produces units 101-127, 201-212 with types and rents assigned.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const organizationId = session.user.organizationId
    const body = await request.json()

    const floors: FloorConfig[] = body.floors || []
    const numbering = body.numbering || 'floor-prefix'
    const prefix = (body.prefix || '').trim()
    const skipExisting = body.skipExisting !== false
    const dryRun = body.dryRun === true

    if (!Array.isArray(floors) || floors.length === 0) {
      return NextResponse.json({ error: 'floors must be a non-empty array' }, { status: 400 })
    }

    const totalCount = floors.reduce((s, f) => s + f.types.reduce((ts, t) => ts + (t.count || 0), 0), 0)
    if (totalCount > 5000) {
      return NextResponse.json({ error: 'Cannot create more than 5000 units in one batch' }, { status: 400 })
    }

    // Build unit list
    type UnitPlan = { unitNo: string; unitType: string; rent: number; floor: number }
    const plan: UnitPlan[] = []
    let globalSeq = 1

    for (const f of floors) {
      let floorSeq = 1
      for (const t of f.types) {
        if (!t.unitType || t.count < 1) continue
        for (let i = 0; i < t.count; i++) {
          let unitNo: string
          if (numbering === 'sequential') {
            unitNo = String(globalSeq).padStart(3, '0')
            globalSeq++
          } else {
            unitNo = `${f.floor}${String(floorSeq).padStart(2, '0')}`
          }
          if (prefix) unitNo = `${prefix}${unitNo}`
          plan.push({ unitNo, unitType: t.unitType, rent: t.rent || 0, floor: f.floor })
          floorSeq++
        }
      }
    }

    // Check duplicates against DB
    const existing = await prisma.unit.findMany({
      where: {
        organizationId,
        unitNo: { in: plan.map((p) => p.unitNo) },
      },
      select: { unitNo: true },
    })
    const existingSet = new Set(existing.map((u) => u.unitNo))

    const preview = plan.map((p) => ({
      ...p,
      conflict: existingSet.has(p.unitNo),
    }))

    if (dryRun) {
      return NextResponse.json({
        total: plan.length,
        conflicts: preview.filter((p) => p.conflict).length,
        preview: preview.slice(0, 200),
        skippingDuplicates: skipExisting,
      })
    }

    let created = 0, skipped = 0, failed = 0
    const errors: string[] = []

    for (const p of plan) {
      if (existingSet.has(p.unitNo) && skipExisting) { skipped++; continue }
      if (existingSet.has(p.unitNo) && !skipExisting) {
        failed++
        errors.push(`Unit ${p.unitNo} already exists`)
        continue
      }
      try {
        await prisma.unit.create({
          data: {
            organizationId,
            unitNo: p.unitNo,
            unitType: p.unitType,
            currentRent: p.rent,
            status: 'Vacant',
            notes: `Floor: ${p.floor}`,
          },
        })
        created++
      } catch (e) {
        failed++
        errors.push(`${p.unitNo}: ${e instanceof Error ? e.message : 'unknown'}`)
      }
    }

    await logActivity(
      organizationId,
      session.user.name,
      'Bulk Add Units (Mixed)',
      `Created ${created}, skipped ${skipped}, failed ${failed} from ${plan.length} planned`
    )

    return NextResponse.json({ total: plan.length, created, skipped, failed, errors: errors.slice(0, 20) })
  } catch (error) {
    console.error('POST /api/units/bulk-mixed error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
