import prisma from '@/lib/prisma'

/**
 * Create a notification for a recipient within an organization.
 * recipientType: 'staff' | 'tenant' | 'all'
 * category: 'system' | 'payment' | 'maintenance' | 'renewal' | 'fee' | 'violation' | 'complaint'
 */
export async function createNotification(
  organizationId: string,
  recipientType: string,
  recipientId: string,
  title: string,
  message: string = '',
  category: string = 'system'
) {
  try {
    await prisma.notification.create({
      data: {
        organizationId,
        recipientType,
        recipientId: recipientId || null,
        title,
        message,
        category,
      },
    })
  } catch (error) {
    console.error('Failed to create notification:', error)
  }
}
