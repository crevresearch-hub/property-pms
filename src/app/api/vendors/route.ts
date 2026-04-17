import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId

    const vendors = await prisma.vendor.findMany({
      where: { organizationId },
      orderBy: { companyName: 'asc' },
    })

    // Parse comma-separated categories into arrays
    const vendorsWithParsedCategories = vendors.map((v: typeof vendors[number]) => ({
      ...v,
      categoriesList: v.categories
        ? v.categories.split(',').map((c: string) => c.trim()).filter(Boolean)
        : [],
    }))

    return NextResponse.json(vendorsWithParsedCategories)
  } catch (error) {
    console.error('GET /api/vendors error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    const body = await request.json()

    const {
      companyName,
      contactPerson,
      phone,
      email,
      tradeLicenseNo,
      tradeLicenseExpiry,
      address,
      status,
      isPreferred,
      categories,
      notes,
    } = body

    if (!companyName) {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      )
    }

    // Normalize categories: accept array or comma-separated string
    let categoriesStr = ''
    if (Array.isArray(categories)) {
      categoriesStr = categories.join(', ')
    } else if (typeof categories === 'string') {
      categoriesStr = categories
    }

    const vendor = await prisma.vendor.create({
      data: {
        organizationId,
        companyName,
        contactPerson: contactPerson || '',
        phone: phone || '',
        email: email || '',
        tradeLicenseNo: tradeLicenseNo || '',
        tradeLicenseExpiry: tradeLicenseExpiry || '',
        address: address || '',
        status: status || 'Active',
        isPreferred: isPreferred === true,
        categories: categoriesStr,
        notes: notes || '',
      },
    })

    await logActivity(
      organizationId,
      session.user.name,
      'Created Vendor',
      `Vendor "${companyName}" created`
    )

    return NextResponse.json(
      {
        ...vendor,
        categoriesList: categoriesStr
          ? categoriesStr.split(',').map(c => c.trim()).filter(Boolean)
          : [],
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/vendors error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
