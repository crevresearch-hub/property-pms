import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

const monthLabel = (d: Date) => d.toLocaleString('en-GB', { month: 'short', year: '2-digit' })
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const organizationId = session.user.organizationId

    const [income, expense, cheques, invoices, payments] = await Promise.all([
      prisma.income.findMany({ where: { organizationId }, orderBy: { dateAdded: 'asc' } }),
      prisma.expense.findMany({ where: { organizationId }, orderBy: { dateAdded: 'asc' } }),
      prisma.cheque.findMany({ where: { organizationId } }),
      prisma.invoice.findMany({ where: { organizationId } }),
      prisma.payment.findMany({ where: { organizationId } }),
    ])

    // Build last 12 months labels
    const months: { key: string; label: string }[] = []
    const now = new Date()
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({ key: monthKey(d), label: monthLabel(d) })
    }
    const monthIndex = new Map(months.map((m, i) => [m.key, i]))

    // Aggregate income & expense by month
    const monthly = months.map((m) => ({
      month: m.label,
      income: 0,
      expense: 0,
      net: 0,
      collectedCheques: 0,
      bouncedCheques: 0,
    }))

    for (const r of income) {
      const k = (r.dateAdded || '').slice(0, 7)
      const idx = monthIndex.get(k)
      if (idx != null) monthly[idx].income += r.amount || 0
    }
    for (const r of expense) {
      const k = (r.dateAdded || '').slice(0, 7)
      const idx = monthIndex.get(k)
      if (idx != null) monthly[idx].expense += r.amount || 0
    }
    for (const c of cheques) {
      if (c.status === 'Cleared' && c.clearedDate) {
        const k = c.clearedDate.slice(0, 7)
        const idx = monthIndex.get(k)
        if (idx != null) monthly[idx].collectedCheques += c.amount || 0
      }
      if (c.status === 'Bounced') {
        const k = (c.chequeDate || '').slice(0, 7)
        const idx = monthIndex.get(k)
        if (idx != null) monthly[idx].bouncedCheques += c.amount || 0
      }
    }
    for (const m of monthly) m.net = m.income - m.expense

    // Income by category
    const incomeByCat: Record<string, number> = {}
    for (const r of income) incomeByCat[r.category || 'Other'] = (incomeByCat[r.category || 'Other'] || 0) + (r.amount || 0)
    const incomeCategories = Object.entries(incomeByCat).map(([k, v]) => ({ category: k, amount: v })).sort((a, b) => b.amount - a.amount)

    // Expense by category
    const expByCat: Record<string, number> = {}
    for (const r of expense) expByCat[r.category || 'Other'] = (expByCat[r.category || 'Other'] || 0) + (r.amount || 0)
    const expenseCategories = Object.entries(expByCat).map(([k, v]) => ({ category: k, amount: v })).sort((a, b) => b.amount - a.amount)

    // Totals
    const totalIncome = income.reduce((s, r) => s + (r.amount || 0), 0)
    const totalExpenses = expense.reduce((s, r) => s + (r.amount || 0), 0)
    const netIncome = totalIncome - totalExpenses
    const profitMargin = totalIncome > 0 ? Math.round((netIncome / totalIncome) * 1000) / 10 : 0

    // Cheque cash buckets
    const today = new Date().toISOString().slice(0, 10)
    const upcoming30 = new Date(); upcoming30.setDate(upcoming30.getDate() + 30)
    const upcoming30Str = upcoming30.toISOString().slice(0, 10)
    const upcoming90 = new Date(); upcoming90.setDate(upcoming90.getDate() + 90)
    const upcoming90Str = upcoming90.toISOString().slice(0, 10)

    const chequeBuckets = {
      pendingDueNext30: 0,
      pendingDueNext90: 0,
      overdue: 0,
      bouncedUnreplaced: 0,
      clearedYTD: 0,
    }
    for (const c of cheques) {
      const isPending = c.status === 'Received' || c.status === 'Pending' || c.status === 'Deposited'
      const d = c.chequeDate || ''
      if (isPending && d) {
        if (d < today) chequeBuckets.overdue += c.amount || 0
        else if (d <= upcoming30Str) chequeBuckets.pendingDueNext30 += c.amount || 0
        else if (d <= upcoming90Str) chequeBuckets.pendingDueNext90 += c.amount || 0
      }
      if (c.status === 'Bounced') chequeBuckets.bouncedUnreplaced += c.amount || 0
      if (c.status === 'Cleared' && c.clearedDate?.startsWith(String(now.getFullYear()))) {
        chequeBuckets.clearedYTD += c.amount || 0
      }
    }

    // Invoices
    const totalInvoiced = invoices.reduce((s, i) => s + (i.totalAmount || 0), 0)
    const totalInvoicePaid = invoices.reduce((s, i) => s + (i.paidAmount || 0), 0)
    const overdueInvoices = invoices.filter((i) => i.status === 'Overdue').length
    const pendingProofs = invoices.filter((i) => i.status === 'Tenant Submitted').length

    // Payments by method (last 90 days)
    const cutoff90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    const paymentsByMethod: Record<string, number> = {}
    for (const p of payments) {
      if (!p.createdAt || p.createdAt < cutoff90) continue
      paymentsByMethod[p.method || 'Other'] = (paymentsByMethod[p.method || 'Other'] || 0) + (p.amount || 0)
    }
    const paymentChannels = Object.entries(paymentsByMethod).map(([k, v]) => ({ method: k, amount: v })).sort((a, b) => b.amount - a.amount)

    // Recent cleared cheques list (last 10)
    const recentClearedCheques = [...cheques]
      .filter((c) => c.status === 'Cleared')
      .sort((a, b) => (b.clearedDate || '').localeCompare(a.clearedDate || ''))
      .slice(0, 10)
      .map((c) => ({ chequeNo: c.chequeNo, amount: c.amount, bankName: c.bankName, clearedDate: c.clearedDate }))

    return NextResponse.json({
      totals: { totalIncome, totalExpenses, netIncome, profitMargin },
      monthly,
      incomeCategories,
      expenseCategories,
      chequeBuckets,
      invoiceTotals: { totalInvoiced, totalInvoicePaid, overdueInvoices, pendingProofs },
      paymentChannels,
      recentClearedCheques,
    })
  } catch (error) {
    console.error('GET /api/ceo/cashflow error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
