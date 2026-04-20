import { NextRequest, NextResponse } from 'next/server'
import { compare } from 'bcryptjs'
import prisma from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const owner = await prisma.propertyOwner.findFirst({
      where: { email },
      include: { organization: { select: { id: true, isActive: true } } },
    })

    if (!owner) {
      return NextResponse.json({ error: 'No owner found with this email' }, { status: 401 })
    }

    if (!owner.organization.isActive) {
      return NextResponse.json({ error: 'Organization is deactivated' }, { status: 401 })
    }

    if (!owner.passwordHash) {
      return NextResponse.json(
        { error: 'Owner portal access has not been set up. Please contact management.' },
        { status: 401 }
      )
    }

    const valid = await compare(password, owner.passwordHash)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
    }

    const sessionData = {
      id: owner.id,
      name: owner.ownerName,
      orgId: owner.organizationId,
      buildingName: owner.buildingName,
    }

    const response = NextResponse.json({ success: true, owner: sessionData })
    response.cookies.set('owner_session', JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24,
    })
    return response
  } catch (error) {
    console.error('POST /api/owner/auth error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.set('owner_session', '', { path: '/', maxAge: 0 })
  return response
}
