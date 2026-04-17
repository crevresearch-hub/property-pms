import prisma from '@/lib/prisma'

/**
 * Log an activity to the ActivityLog table.
 * Every log is scoped to an organization for multi-tenant isolation.
 */
export async function logActivity(
  organizationId: string,
  user: string,
  action: string,
  details: string = ''
) {
  try {
    await prisma.activityLog.create({
      data: {
        organizationId,
        user,
        action,
        details,
      },
    })
  } catch (error) {
    console.error('Failed to log activity:', error)
  }
}
