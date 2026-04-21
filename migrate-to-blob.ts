import prisma from './src/lib/prisma'
import { readFile } from 'fs/promises'
import path from 'path'
import { put } from '@vercel/blob'

;(async () => {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) {
    console.error('❌ BLOB_READ_WRITE_TOKEN is not set in .env')
    console.error('   1. Go to vercel.com → your project → Storage tab')
    console.error('   2. Create a Blob store')
    console.error('   3. Copy the BLOB_READ_WRITE_TOKEN')
    console.error('   4. Add it to d:/Projects/property-pms/.env')
    console.error('   5. Also add it to Vercel → Settings → Environment Variables')
    process.exit(1)
  }

  const org = await prisma.organization.findFirst()
  if (!org) { console.error('No org'); process.exit(1) }

  const docs = await prisma.tenantDocument.findMany({
    where: {
      organizationId: org.id,
      NOT: { filePath: { startsWith: 'http' } },
    },
  })

  console.log(`Found ${docs.length} documents still on local disk.`)
  let success = 0, failed = 0, skipped = 0

  for (let i = 0; i < docs.length; i++) {
    const d = docs[i]
    const pct = Math.round(((i + 1) / docs.length) * 100)
    try {
      const fullPath = path.join(process.cwd(), d.filePath)
      const buf = await readFile(fullPath).catch(() => null)
      if (!buf) {
        skipped++
        process.stdout.write(`\r[${pct}%] ${i + 1}/${docs.length} — skipped (${skipped}), missing: ${d.filename}\n`)
        continue
      }

      const blob = await put(`tenant_${d.tenantId}/${d.filename}`, buf, {
        access: 'public',
        token,
        contentType: 'application/pdf',
        addRandomSuffix: false,
        allowOverwrite: true,
      })

      await prisma.tenantDocument.update({
        where: { id: d.id },
        data: { filePath: blob.url },
      })
      success++
      process.stdout.write(`\r[${pct}%] ${i + 1}/${docs.length} — uploaded (${success}), skipped (${skipped}), failed (${failed})`)
    } catch (e) {
      failed++
      process.stdout.write(`\n  ✗ Failed ${d.filename}: ${(e as Error).message}\n`)
    }
  }

  console.log(`\n\n=== MIGRATION COMPLETE ===`)
  console.log(`Uploaded:  ${success}`)
  console.log(`Skipped:   ${skipped} (files missing on disk)`)
  console.log(`Failed:    ${failed}`)
  console.log(`Total:     ${docs.length}`)
  process.exit(0)
})().catch(e => { console.error(e); process.exit(1) })
