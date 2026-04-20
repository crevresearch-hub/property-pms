import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { rm, readdir } from 'fs/promises'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    if (body.confirm !== 'DELETE ALL') {
      return NextResponse.json(
        { error: 'Confirmation required. Send { "confirm": "DELETE ALL" } to proceed.' },
        { status: 400 }
      )
    }

    const organizationId = session.user.organizationId

    const [tenants, docs, units] = await prisma.$transaction([
      prisma.tenant.findMany({ where: { organizationId }, select: { id: true } }),
      prisma.tenantDocument.deleteMany({ where: { organizationId } }),
      prisma.unit.updateMany({
        where: { organizationId, tenantId: { not: null } },
        data: { tenantId: null, status: 'Vacant' },
      }),
    ])

    const deletedTenants = await prisma.tenant.deleteMany({ where: { organizationId } })

    // Remove uploaded files on disk
    const uploadsRoot = path.join(process.cwd(), 'uploads')
    const removedDirs: string[] = []
    try {
      const entries = await readdir(uploadsRoot)
      for (const e of entries) {
        if (!e.startsWith('tenant_')) continue
        const tenantId = e.replace('tenant_', '')
        if (tenants.some((t) => t.id === tenantId)) {
          await rm(path.join(uploadsRoot, e), { recursive: true, force: true }).catch(() => {})
          removedDirs.push(e)
        }
      }
    } catch {}

    await logActivity(
      organizationId,
      session.user.name,
      'Reset All Tenants',
      `Deleted ${deletedTenants.count} tenants, ${docs.count} documents, cleared ${units.count} unit assignments, removed ${removedDirs.length} upload folders`
    )

    return NextResponse.json({
      deletedTenants: deletedTenants.count,
      deletedDocuments: docs.count,
      clearedUnits: units.count,
      removedUploadFolders: removedDirs.length,
    })
  } catch (error) {
    console.error('POST /api/admin/import-tenants/reset error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
