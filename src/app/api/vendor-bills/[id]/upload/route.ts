import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import path from 'path'
import { mkdir, writeFile } from 'fs/promises'

// Upload a vendor invoice file OR a payment proof file (cheque image / bank
// transfer receipt). Form data:
//   file: <File>
//   kind: "invoice" | "payment"
// Saves under uploads/vendor-bill_<id>/ and updates the bill row's
// invoiceFileName / paymentFileName field.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const organizationId = session.user.organizationId

    const bill = await prisma.vendorBill.findFirst({ where: { id, organizationId } })
    if (!bill) return NextResponse.json({ error: 'Bill not found' }, { status: 404 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const kind = (formData.get('kind') as string) || 'invoice'
    if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 })
    if (!['invoice', 'payment'].includes(kind)) {
      return NextResponse.json({ error: 'kind must be "invoice" or "payment"' }, { status: 400 })
    }

    const ext = path.extname(file.name) || ''
    const ts = Date.now()
    const safeName = file.name.replace(ext, '').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50)
    const filename = `${kind}_${ts}_${safeName}${ext}`

    const uploadDir = path.join(process.cwd(), 'uploads', `vendor-bill_${id}`)
    await mkdir(uploadDir, { recursive: true }).catch(() => {})
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(path.join(uploadDir, filename), buffer)

    const updated = await prisma.vendorBill.update({
      where: { id },
      data: kind === 'invoice'
        ? { invoiceFileName: filename }
        : { paymentFileName: filename },
    })

    return NextResponse.json({ ok: true, filename, bill: updated })
  } catch (error) {
    console.error('POST /api/vendor-bills/[id]/upload error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET — stream the uploaded file back. ?kind=invoice|payment.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const kind = searchParams.get('kind') || 'invoice'

    const bill = await prisma.vendorBill.findFirst({
      where: { id, organizationId: session.user.organizationId },
    })
    if (!bill) return NextResponse.json({ error: 'Bill not found' }, { status: 404 })

    const filename = kind === 'invoice' ? bill.invoiceFileName : bill.paymentFileName
    if (!filename) return NextResponse.json({ error: 'No file' }, { status: 404 })

    const filePath = path.join(process.cwd(), 'uploads', `vendor-bill_${id}`, filename)
    const { readFile } = await import('fs/promises')
    const buffer = await readFile(filePath)
    const ext = path.extname(filename).toLowerCase()
    const mime =
      ext === '.pdf' ? 'application/pdf' :
      ext === '.png' ? 'image/png' :
      ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
      'application/octet-stream'
    return new NextResponse(buffer, {
      headers: { 'Content-Type': mime, 'Content-Disposition': `inline; filename="${filename}"` },
    })
  } catch (error) {
    console.error('GET /api/vendor-bills/[id]/upload error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
