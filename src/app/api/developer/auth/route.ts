import { NextRequest, NextResponse } from 'next/server'

const DEV_PASSWORD = process.env.DEV_PASSWORD || 'Alwaan@Dev2026!'

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()
    if (password !== DEV_PASSWORD) {
      return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
    }
    const response = NextResponse.json({ success: true })
    response.cookies.set('dev_unlocked', '1', {
      httpOnly: false, // readable by client JS
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8, // 8 hours
    })
    return response
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.set('dev_unlocked', '', { path: '/', maxAge: 0 })
  return response
}
