import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { parseEid, runOcrSpace } from '@/lib/eid-parser'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const apiKey = process.env.OCR_SPACE_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OCR_SPACE_API_KEY not set in .env' },
        { status: 500 }
      )
    }

    const form = await request.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

    const buf = Buffer.from(await file.arrayBuffer())
    const mime = file.type || 'image/png'
    const fileName = file.name || 'eid.png'

    const [engText, araText] = await Promise.all([
      runOcrSpace(buf, mime, fileName, apiKey, 'eng'),
      runOcrSpace(buf, mime, fileName, apiKey, 'ara'),
    ])
    if (!engText && !araText) {
      return NextResponse.json({ error: 'No text detected in image' }, { status: 422 })
    }

    const parsed = parseEid(engText, araText)
    return NextResponse.json(parsed)
  } catch (error) {
    console.error('POST /api/eid/ocr error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
