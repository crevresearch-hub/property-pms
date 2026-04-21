import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyOwnerSetupToken } from '@/lib/owner-setup-token'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  const base = request.nextUrl.origin

  if (!token) {
    return NextResponse.redirect(`${base}/owner/login?error=no-token`)
  }

  const check = verifyOwnerSetupToken(token)
  if (!check.valid || !check.ownerId) {
    return NextResponse.redirect(`${base}/owner/login?error=invalid-or-expired`)
  }

  const owner = await prisma.propertyOwner.findUnique({
    where: { id: check.ownerId },
    include: { organization: { select: { id: true, isActive: true } } },
  })

  if (!owner || !owner.organization.isActive) {
    return NextResponse.redirect(`${base}/owner/login?error=owner-not-found`)
  }

  const sessionData = {
    id: owner.id,
    name: owner.ownerName,
    orgId: owner.organizationId,
    buildingName: owner.buildingName,
  }

  const response = NextResponse.redirect(`${base}/owner/dashboard`)
  response.cookies.set('owner_session', JSON.stringify(sessionData), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })
  return response
}
