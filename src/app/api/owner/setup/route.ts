import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { hash } from 'bcryptjs'
import { verifyOwnerSetupToken } from '@/lib/owner-setup-token'

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json()
    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password are required' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const check = verifyOwnerSetupToken(token)
    if (!check.valid || !check.ownerId) {
      return NextResponse.json({ error: check.reason || 'Invalid token' }, { status: 400 })
    }

    const owner = await prisma.propertyOwner.findUnique({ where: { id: check.ownerId } })
    if (!owner) return NextResponse.json({ error: 'Owner not found' }, { status: 404 })

    const passwordHash = await hash(password, 10)
    await prisma.propertyOwner.update({
      where: { id: owner.id },
      data: { passwordHash },
    })

    return NextResponse.json({ success: true, email: owner.email })
  } catch (error) {
    console.error('POST /api/owner/setup error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ valid: false, reason: 'No token' })
  const check = verifyOwnerSetupToken(token)
  if (!check.valid) return NextResponse.json({ valid: false, reason: check.reason })
  const owner = await prisma.propertyOwner.findUnique({ where: { id: check.ownerId! } })
  if (!owner) return NextResponse.json({ valid: false, reason: 'Owner not found' })
  return NextResponse.json({
    valid: true,
    email: owner.email,
    ownerName: owner.ownerName,
    buildingName: owner.buildingName,
    alreadySet: !!owner.passwordHash,
  })
}
