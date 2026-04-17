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

    // Units summary
    const units = await prisma.unit.findMany({
      where: { organizationId },
      select: { status: true, currentRent: true },
    })

    type UnitRow = { status: string; currentRent: number }
    const totalUnits = units.length
    const occupied = units.filter((u: UnitRow) => u.status === 'Occupied').length
    const vacant = units.filter((u: UnitRow) => u.status === 'Vacant').length
    const grossRent = units
      .filter((u: UnitRow) => u.status === 'Occupied')
      .reduce((sum: number, u: UnitRow) => sum + u.currentRent, 0)
    const occupancyRate = totalUnits > 0
      ? Math.round((occupied / totalUnits) * 10000) / 100
      : 0

    // Income
    const incomeItems = await prisma.income.findMany({
      where: { organizationId },
      select: { amount: true },
    })
    const totalIncome = incomeItems.reduce((sum: number, i: { amount: number }) => sum + i.amount, 0)

    // Expenses
    const expenseItems = await prisma.expense.findMany({
      where: { organizationId },
      select: { amount: true },
    })
    const totalExpenses = expenseItems.reduce((sum: number, e: { amount: number }) => sum + e.amount, 0)

    const netIncome = totalIncome - totalExpenses

    return NextResponse.json({
      total_units: totalUnits,
      occupied,
      vacant,
      gross_rent: grossRent,
      occupancy_rate: occupancyRate,
      total_income: totalIncome,
      total_expenses: totalExpenses,
      net_income: netIncome,
    })
  } catch (error) {
    console.error('GET /api/dashboard error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
