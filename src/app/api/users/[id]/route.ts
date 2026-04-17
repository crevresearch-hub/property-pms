import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { hash } from 'bcryptjs'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const organizationId = session.user.organizationId
    const { id } = await params
    const body = await request.json()

    const existing = await prisma.user.findFirst({
      where: { id, organizationId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    if (body.name !== undefined) updateData.name = body.name
    if (body.email !== undefined) {
      // Check email uniqueness
      const emailUser = await prisma.user.findUnique({ where: { email: body.email } })
      if (emailUser && emailUser.id !== id) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
      }
      updateData.email = body.email
    }
    if (body.role !== undefined) updateData.role = body.role
    if (body.isActive !== undefined) updateData.isActive = body.isActive
    if (body.password) {
      updateData.password = await hash(body.password, 12)
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    await logActivity(
      organizationId,
      session.user.name,
      'Updated User',
      `User ${user.name} (${user.email}) updated`
    )

    return NextResponse.json(user)
  } catch (error) {
    console.error('PUT /api/users/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const organizationId = session.user.organizationId
    const { id } = await params

    // Cannot delete self
    if (id === session.user.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
    }

    const existing = await prisma.user.findFirst({
      where: { id, organizationId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    await prisma.user.delete({ where: { id } })

    await logActivity(
      organizationId,
      session.user.name,
      'Deleted User',
      `User ${existing.name} (${existing.email}) deleted`
    )

    return NextResponse.json({ message: 'User deleted' })
  } catch (error) {
    console.error('DELETE /api/users/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
