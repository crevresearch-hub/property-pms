import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

/**
 * Bulk create units.
 * Body: {
 *   floors: number,            // e.g. 3
 *   unitsPerFloor: number,     // e.g. 67  (3*67 = 201 units)
 *   startFloor?: number,       // default 1
 *   numbering?: 'floor-prefix' | 'sequential',  // default 'floor-prefix' (101,102 / 201,202)
 *   prefix?: string,           // optional prefix like 'A-' → A-101
 *   unitType?: string,         // default 'Flat'
 *   currentRent?: number,      // default 0 (can edit per unit later)
 *   status?: string,           // default 'Vacant'
 *   skipExisting?: boolean,    // default true
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const isDeveloper = session.user.id === 'admin-dev' || session.user.email === 'admin@cre.ae'
    if (!isDeveloper) {
      return NextResponse.json({ error: 'Only the developer can bulk-create units' }, { status: 403 })
    }

    const organizationId = session.user.organizationId
    const body = await request.json()

    const floors = parseInt(body.floors, 10)
    const unitsPerFloor = parseInt(body.unitsPerFloor, 10)
    const startFloor = parseInt(body.startFloor || 1, 10)
    const numbering = body.numbering || 'floor-prefix'
    const prefix = (body.prefix || '').trim()
    const unitType = body.unitType || 'Flat'
    const currentRent = parseFloat(body.currentRent || 0)
    const status = body.status || 'Vacant'
    const skipExisting = body.skipExisting !== false // default true

    if (!floors || floors < 1 || floors > 200) {
      return NextResponse.json({ error: 'floors must be 1-200' }, { status: 400 })
    }
    if (!unitsPerFloor || unitsPerFloor < 1 || unitsPerFloor > 500) {
      return NextResponse.json({ error: 'unitsPerFloor must be 1-500' }, { status: 400 })
    }
    if (floors * unitsPerFloor > 5000) {
      return NextResponse.json({ error: 'Cannot create more than 5000 units in one batch' }, { status: 400 })
    }

    // Build unit numbers
    type UnitToCreate = { unitNo: string; floor: number }
    const planned: UnitToCreate[] = []
    let sequentialCounter = 1
    for (let f = startFloor; f < startFloor + floors; f++) {
      for (let i = 1; i <= unitsPerFloor; i++) {
        let unitNo: string
        if (numbering === 'sequential') {
          unitNo = String(sequentialCounter).padStart(3, '0')
          sequentialCounter++
        } else {
          // floor-prefix: floor 1 → 101, 102, ... | floor 2 → 201, 202, ...
          unitNo = `${f}${String(i).padStart(2, '0')}`
        }
        if (prefix) unitNo = `${prefix}${unitNo}`
        planned.push({ unitNo, floor: f })
      }
    }

    // Find existing unit numbers in this org
    const existing = await prisma.unit.findMany({
      where: {
        organizationId,
        unitNo: { in: planned.map((p) => p.unitNo) },
      },
      select: { unitNo: true },
    })
    const existingSet = new Set(existing.map((e) => e.unitNo))

    let toCreate = planned
    if (skipExisting) {
      toCreate = planned.filter((p) => !existingSet.has(p.unitNo))
    } else if (existingSet.size > 0) {
      return NextResponse.json(
        { error: `${existingSet.size} unit numbers already exist. Set skipExisting=true to ignore them.` },
        { status: 409 }
      )
    }

    if (toCreate.length === 0) {
      return NextResponse.json({
        message: 'All units already exist',
        created: 0,
        skipped: planned.length,
      })
    }

    const result = await prisma.unit.createMany({
      data: toCreate.map((p) => ({
        organizationId,
        unitNo: p.unitNo,
        unitType,
        currentRent,
        status,
        notes: `Floor ${p.floor}`,
      })),
      skipDuplicates: true,
    })

    await logActivity(
      organizationId,
      session.user.name,
      'Bulk Created Units',
      `${result.count} units created (${floors} floors × ${unitsPerFloor}/floor)`
    )

    return NextResponse.json({
      message: 'Units created successfully',
      requested: planned.length,
      created: result.count,
      skipped: planned.length - result.count,
    }, { status: 201 })
  } catch (error) {
    console.error('POST /api/units/bulk error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
