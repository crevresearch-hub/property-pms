import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { hash } from 'bcryptjs'

export async function POST() {
  try {
    // Check if organization already exists
    const existing = await prisma.organization.findUnique({
      where: { slug: 'alwan' },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Demo organization already exists', organizationId: existing.id },
        { status: 409 }
      )
    }

    // Create organization
    const org = await prisma.organization.create({
      data: {
        name: 'Alwan Residence',
        slug: 'alwan',
        email: 'info@alwan.com',
        phone: '+971-4-000-0000',
        address: 'Dubai, UAE',
        plan: 'professional',
        maxUnits: 200,
        isActive: true,
      },
    })

    // Create admin user
    const hashedPassword = await hash('admin123', 12)
    const admin = await prisma.user.create({
      data: {
        organizationId: org.id,
        name: 'Admin',
        email: 'admin@alwan.com',
        password: hashedPassword,
        role: 'admin',
        isActive: true,
      },
    })

    // Create sample tenants
    const tenants = await Promise.all([
      prisma.tenant.create({
        data: {
          organizationId: org.id,
          name: 'Ahmed Al Maktoum',
          phone: '+971-50-111-1111',
          email: 'ahmed@example.com',
          emiratesId: '784-1990-1234567-1',
          nationality: 'UAE',
          status: 'Active',
        },
      }),
      prisma.tenant.create({
        data: {
          organizationId: org.id,
          name: 'Fatima Hassan',
          phone: '+971-50-222-2222',
          email: 'fatima@example.com',
          emiratesId: '784-1985-2345678-2',
          nationality: 'UAE',
          status: 'Active',
        },
      }),
      prisma.tenant.create({
        data: {
          organizationId: org.id,
          name: 'John Smith',
          phone: '+971-50-333-3333',
          email: 'john@example.com',
          passportNo: 'GB123456',
          nationality: 'UK',
          status: 'Active',
        },
      }),
      prisma.tenant.create({
        data: {
          organizationId: org.id,
          name: 'Priya Sharma',
          phone: '+971-50-444-4444',
          email: 'priya@example.com',
          passportNo: 'IN987654',
          nationality: 'India',
          status: 'Active',
        },
      }),
      prisma.tenant.create({
        data: {
          organizationId: org.id,
          name: 'Mohammad Ali',
          phone: '+971-50-555-5555',
          email: 'mohammad@example.com',
          emiratesId: '784-1988-3456789-3',
          nationality: 'Jordan',
          status: 'Active',
        },
      }),
    ])

    // Create sample units
    const units = await Promise.all([
      prisma.unit.create({
        data: {
          organizationId: org.id,
          unitNo: '101',
          unitType: 'Studio',
          contractStart: '2025-01-01',
          contractEnd: '2025-12-31',
          currentRent: 35000,
          status: 'Occupied',
          tenantId: tenants[0].id,
        },
      }),
      prisma.unit.create({
        data: {
          organizationId: org.id,
          unitNo: '102',
          unitType: '1BR',
          contractStart: '2025-03-01',
          contractEnd: '2026-02-28',
          currentRent: 55000,
          status: 'Occupied',
          tenantId: tenants[1].id,
        },
      }),
      prisma.unit.create({
        data: {
          organizationId: org.id,
          unitNo: '201',
          unitType: '2BR',
          contractStart: '2025-06-01',
          contractEnd: '2026-05-31',
          currentRent: 80000,
          status: 'Occupied',
          tenantId: tenants[2].id,
        },
      }),
      prisma.unit.create({
        data: {
          organizationId: org.id,
          unitNo: '202',
          unitType: '1BR',
          contractStart: '2025-02-01',
          contractEnd: '2026-01-31',
          currentRent: 50000,
          status: 'Occupied',
          tenantId: tenants[3].id,
        },
      }),
      prisma.unit.create({
        data: {
          organizationId: org.id,
          unitNo: '301',
          unitType: '3BR',
          currentRent: 120000,
          status: 'Vacant',
        },
      }),
      prisma.unit.create({
        data: {
          organizationId: org.id,
          unitNo: '302',
          unitType: 'Studio',
          contractStart: '2024-09-01',
          contractEnd: '2025-08-31',
          currentRent: 32000,
          status: 'Occupied',
          tenantId: tenants[4].id,
        },
      }),
      prisma.unit.create({
        data: {
          organizationId: org.id,
          unitNo: '401',
          unitType: '2BR',
          currentRent: 75000,
          status: 'Vacant',
        },
      }),
      prisma.unit.create({
        data: {
          organizationId: org.id,
          unitNo: '402',
          unitType: 'Penthouse',
          currentRent: 180000,
          status: 'Vacant',
        },
      }),
    ])

    return NextResponse.json({
      message: 'Demo data seeded successfully',
      organization: { id: org.id, name: org.name, slug: org.slug },
      admin: { id: admin.id, email: admin.email, password: 'admin123' },
      tenants: tenants.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })),
      units: units.map((u: { id: string; unitNo: string; status: string }) => ({ id: u.id, unitNo: u.unitNo, status: u.status })),
    }, { status: 201 })
  } catch (error) {
    console.error('POST /api/seed error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
