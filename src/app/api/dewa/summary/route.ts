import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId

    const readings = await prisma.dewaReading.findMany({
      where: { organizationId },
      select: {
        month: true,
        electricityCharge: true,
        waterCharge: true,
        sewageCharge: true,
        totalCharge: true,
        status: true,
      },
    })

    type ReadingRow = { month: string; electricityCharge: number; waterCharge: number; sewageCharge: number; totalCharge: number; status: string }
    const total_charges = readings.reduce((sum: number, r: ReadingRow) => sum + r.totalCharge, 0)
    const pending = readings
      .filter((r: ReadingRow) => r.status === 'Pending')
      .reduce((sum: number, r: ReadingRow) => sum + r.totalCharge, 0)
    const paid = readings
      .filter((r: ReadingRow) => r.status === 'Paid')
      .reduce((sum: number, r: ReadingRow) => sum + r.totalCharge, 0)
    const total_electricity = readings.reduce((sum: number, r: ReadingRow) => sum + r.electricityCharge, 0)
    const total_water = readings.reduce((sum: number, r: ReadingRow) => sum + r.waterCharge, 0)

    // Monthly breakdown
    const monthlyMap: Record<string, {
      electricity: number
      water: number
      sewage: number
      total: number
      count: number
    }> = {}

    for (const r of readings) {
      if (!monthlyMap[r.month]) {
        monthlyMap[r.month] = { electricity: 0, water: 0, sewage: 0, total: 0, count: 0 }
      }
      monthlyMap[r.month].electricity += r.electricityCharge
      monthlyMap[r.month].water += r.waterCharge
      monthlyMap[r.month].sewage += r.sewageCharge
      monthlyMap[r.month].total += r.totalCharge
      monthlyMap[r.month].count++
    }

    const monthly_breakdown = Object.entries(monthlyMap)
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => b.month.localeCompare(a.month))

    return NextResponse.json({
      total_charges,
      pending,
      paid,
      total_electricity,
      total_water,
      monthly_breakdown,
    })
  } catch (error) {
    console.error('GET /api/dewa/summary error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
