import { NextRequest, NextResponse } from 'next/server'
import { compare } from 'bcryptjs'
import prisma from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Find tenant by email (email is not unique in schema, so use findFirst)
    const tenant = await prisma.tenant.findFirst({
      where: { email, status: 'Active' },
      include: { organization: { select: { id: true, isActive: true } } },
    })

    if (!tenant) {
      return NextResponse.json(
        { error: 'No active tenant account found with this email' },
        { status: 401 }
      )
    }

    if (!tenant.organization.isActive) {
      return NextResponse.json(
        { error: 'Organization is deactivated' },
        { status: 401 }
      )
    }

    if (!tenant.passwordHash) {
      return NextResponse.json(
        { error: 'Tenant portal access has not been set up. Please contact management.' },
        { status: 401 }
      )
    }

    const isPasswordValid = await compare(password, tenant.passwordHash)

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      )
    }

    // Build session payload
    const sessionData = {
      id: tenant.id,
      name: tenant.name,
      orgId: tenant.organizationId,
    }

    const response = NextResponse.json({
      success: true,
      tenant: sessionData,
    })

    // Set secure httpOnly cookie
    response.cookies.set('tenant_session', JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    })

    return response
  } catch (error) {
    console.error('POST /api/tenant/auth error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
