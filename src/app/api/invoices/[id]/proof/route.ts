import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import prisma from '@/lib/prisma'
import { getTenantSession } from '@/lib/tenant-auth'
import { createNotification } from '@/lib/notifications'

export const runtime = 'nodejs'

const ALLOWED = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
const MAX_BYTES = 10 * 1024 * 1024

/**
 * POST /api/invoices/[id]/proof
 *
 * Public to logged-in tenants. Tenant uploads a proof of payment (bank transfer
 * receipt, scanned cheque, etc.) for an invoice they were billed for. Stored
 * as a TenantDocument with docType "Invoice Proof - {invoiceNo}". Notifies
 * staff to verify.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getTenantSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Tenant login required' }, { status: 401 })
    }

    const { id } = await params
    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId: session.orgId, tenantId: session.id },
    })
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const form = await request.formData()
    const file = form.get('file')
    const note = String(form.get('note') || '').slice(0, 500)
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }
    const mime = (file.type || '').toLowerCase()
    if (!ALLOWED.has(mime)) {
      return NextResponse.json({ error: 'File must be PDF, JPG, PNG or WebP' }, { status: 400 })
    }
    if (file.size === 0) return NextResponse.json({ error: 'File is empty' }, { status: 400 })
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File must be 10 MB or smaller' }, { status: 413 })
    }

    const buf = Buffer.from(await file.arrayBuffer())
    const ext = mime.split('/')[1].replace('jpeg', 'jpg')
    const filename = `proof-${Date.now()}.${ext}`
    const dir = path.join(process.cwd(), 'uploads', 'invoice-proofs', invoice.id)
    await mkdir(dir, { recursive: true }).catch(() => {})
    await writeFile(path.join(dir, filename), buf).catch(() => {})
    const relPath = `uploads/invoice-proofs/${invoice.id}/${filename}`

    const doc = await prisma.tenantDocument.create({
      data: {
        organizationId: session.orgId,
        tenantId: session.id,
        docType: `Invoice Proof - ${invoice.invoiceNo}`,
        filename,
        originalFilename: file.name || filename,
        filePath: relPath,
        fileSize: buf.length,
        status: 'Uploaded',
        reviewNotes: note ? `Tenant note: ${note}` : 'Submitted via tenant portal',
      },
    })

    // Flip invoice status so PM dashboard shows "Tenant Submitted" badge.
    // Append the proof reference to invoice notes for traceability.
    const ref = `PROOF_DOC:${doc.id}|${filename}`
    const newNotes = [(invoice as { notes?: string }).notes || '', ref].filter(Boolean).join('\n')
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: 'Tenant Submitted',
        notes: newNotes,
      },
    }).catch(() => {})

    // Notify staff
    await createNotification(
      session.orgId,
      'staff',
      '',
      'Invoice Proof Submitted',
      `${session.name} uploaded proof for invoice ${invoice.invoiceNo}. Please verify.`,
      'payment'
    )

    return NextResponse.json({
      ok: true,
      documentId: doc.id,
      filename: doc.filename,
      size: doc.fileSize,
    })
  } catch (error) {
    console.error('POST /api/invoices/[id]/proof error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
