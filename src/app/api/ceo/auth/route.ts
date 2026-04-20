import { NextRequest, NextResponse } from 'next/server'
import { compare } from 'bcryptjs'
import { CEO_COOKIE_NAME, CEO_SESSION_MAX_AGE, createCeoSession } from '@/lib/ceo-auth'

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Password required' }, { status: 400 })
    }

    const hash = process.env.CEO_PASSWORD_HASH
    const secret = process.env.CEO_SESSION_SECRET
    if (!hash || !secret) {
      return NextResponse.json(
        {
          error:
            'CEO access not configured. Set CEO_PASSWORD_HASH and CEO_SESSION_SECRET in .env.',
        },
        { status: 500 },
      )
    }

    const ok = await compare(password, hash)
    if (!ok) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
    }

    const token = await createCeoSession(secret)
    const res = NextResponse.json({ success: true })
    res.cookies.set(CEO_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: CEO_SESSION_MAX_AGE,
    })
    return res
  } catch (error) {
    console.error('POST /api/ceo/auth error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE() {
  const res = NextResponse.json({ success: true })
  res.cookies.set(CEO_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
  return res
}
