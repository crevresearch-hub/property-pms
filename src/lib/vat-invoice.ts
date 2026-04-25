import prisma from '@/lib/prisma'

/**
 * Generates an Alwaan-format VAT invoice number:
 *   Alw/<unitNo>/<year>/<month>/<NNNN>
 * Where NNNN restarts at 0001 for each (unit, year, month) bucket.
 */
export async function generateAlwaanInvoiceNo(
  organizationId: string,
  unitNo: string,
  paymentDate: string // YYYY-MM-DD
): Promise<string> {
  const safeUnit = (unitNo || 'NA').replace(/[^\w-]/g, '')
  const [year, month] = (paymentDate || new Date().toISOString().slice(0, 10)).split('-')
  const prefix = `Alw/${safeUnit}/${year}/${month}/`

  const lastInvoice = await prisma.invoice.findFirst({
    where: { organizationId, invoiceNo: { startsWith: prefix } },
    orderBy: { invoiceNo: 'desc' },
    select: { invoiceNo: true },
  })

  let nextNum = 1
  if (lastInvoice) {
    const tail = lastInvoice.invoiceNo.slice(prefix.length)
    const n = parseInt(tail, 10)
    if (!Number.isNaN(n)) nextNum = n + 1
  }

  return `${prefix}${String(nextNum).padStart(4, '0')}`
}

interface CreateVatInvoiceInput {
  organizationId: string
  tenantId?: string | null
  unitId?: string | null
  unitNo: string
  type: string // 'Admin Fee', 'Commission', 'Rent', etc.
  baseAmount: number
  vatRate?: number // default 5%
  paymentDate: string // YYYY-MM-DD — drives invoice number + bucket
  notes?: string
  createdBy?: string
}

/**
 * Creates an Invoice row representing a VAT-bearing collection.
 * Used by automatic flows (admin/ejari fees collected, commercial rent received, etc.).
 * Returns the created invoice. Does NOT send email — caller decides.
 */
export async function createVatInvoice(input: CreateVatInvoiceInput) {
  const vatRate = input.vatRate ?? 0.05
  const vatAmount = Math.round(input.baseAmount * vatRate)
  const totalAmount = input.baseAmount + vatAmount

  const invoiceNo = await generateAlwaanInvoiceNo(
    input.organizationId,
    input.unitNo,
    input.paymentDate
  )

  const invoice = await prisma.invoice.create({
    data: {
      organizationId: input.organizationId,
      invoiceNo,
      tenantId: input.tenantId || null,
      unitId: input.unitId || null,
      type: input.type,
      amount: input.baseAmount,
      vatAmount,
      totalAmount,
      dueDate: input.paymentDate,
      periodStart: input.paymentDate,
      periodEnd: input.paymentDate,
      status: 'Paid', // auto-generated invoices are for already-collected payments
      paidAmount: totalAmount,
      notes: input.notes || `Auto-generated VAT invoice (${input.type})`,
    },
  })

  return invoice
}
