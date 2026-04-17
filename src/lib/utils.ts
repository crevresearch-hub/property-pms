import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO, differenceInDays } from 'date-fns'

/**
 * Merge Tailwind CSS class names with conflict resolution.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a number as AED currency.
 * Example: 12500 -> "AED 12,500.00"
 */
export function formatCurrency(amount: number): string {
  return `AED ${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/**
 * Format a date string or Date object for display.
 * Example: "2026-04-11" -> "11 Apr 2026"
 */
export function formatDate(date: string | Date): string {
  if (!date) return ''
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'dd MMM yyyy')
}

/**
 * Generate a sequential document number.
 * Example: generateNo("INV", 0) -> "INV-2026-0001"
 * Example: generateNo("INV", 42) -> "INV-2026-0043"
 */
export function generateNo(prefix: string, lastNo: number): string {
  const year = new Date().getFullYear()
  const next = (lastNo + 1).toString().padStart(4, '0')
  return `${prefix}-${year}-${next}`
}

/**
 * Calculate the number of days until a given date string.
 * Positive = future, negative = past.
 */
export function daysUntil(dateStr: string): number {
  if (!dateStr) return 0
  const target = parseISO(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return differenceInDays(target, today)
}
