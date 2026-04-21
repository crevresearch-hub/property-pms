import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

interface StoredFile {
  filePath: string   // what we save to the DB
  size: number
  isCloud: boolean
}

/**
 * Unified file storage. Uses Vercel Blob in production (when
 * BLOB_READ_WRITE_TOKEN is set), falls back to local filesystem for dev.
 *
 * @param buffer     the file bytes
 * @param tenantId   tenant id (used for folder namespace)
 * @param filename   safe filename (e.g. "1234_emirates_id.pdf")
 * @param mime       content type (default application/pdf)
 */
export async function saveFile(
  buffer: Buffer,
  tenantId: string,
  filename: string,
  mime: string = 'application/pdf'
): Promise<StoredFile> {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (token) {
    // Vercel Blob
    const { put } = await import('@vercel/blob')
    const blob = await put(`tenant_${tenantId}/${filename}`, buffer, {
      access: 'public',
      token,
      contentType: mime,
      addRandomSuffix: false,
      allowOverwrite: true,
    })
    return { filePath: blob.url, size: buffer.length, isCloud: true }
  }

  // Local filesystem fallback
  const uploadDir = path.join(process.cwd(), 'uploads', `tenant_${tenantId}`)
  await mkdir(uploadDir, { recursive: true }).catch(() => {})
  const diskPath = path.join(uploadDir, filename)
  await writeFile(diskPath, buffer)
  return { filePath: `uploads/tenant_${tenantId}/${filename}`, size: buffer.length, isCloud: false }
}

/**
 * Given a stored filePath, return either:
 *   - a Blob URL (starts with https://) → redirect to it
 *   - a local relative path → read from disk
 */
export function isCloudUrl(filePath: string): boolean {
  return filePath.startsWith('http://') || filePath.startsWith('https://')
}
