import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { hash } from 'bcryptjs'
import { logActivity } from '@/lib/activity'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const organizationId = session.user.organizationId
    const { id } = await params
    const { password } = await request.json()

    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const owner = await prisma.propertyOwner.findFirst({ where: { id, organizationId } })
    if (!owner) return NextResponse.json({ error: 'Owner not found' }, { status: 404 })

    const passwordHash = await hash(password, 10)
    await prisma.propertyOwner.update({
      where: { id },
      data: { passwordHash },
    })

    await logActivity(
      organizationId,
      session.user.name,
      'Set Owner Password',
      `${owner.ownerName} (${owner.email})`
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('POST /api/owners/[id]/set-password error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
