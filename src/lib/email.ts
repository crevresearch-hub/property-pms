import prisma from '@/lib/prisma'

export interface SendEmailOptions {
  organizationId: string
  to: string
  toName?: string
  subject: string
  html: string
  template: string
  triggeredBy?: string
  refType?: string
  refId?: string
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Strip HTML tags to get a plain-text preview of the body that we can
 * persist into EmailLog.body. We keep full HTML out of the log row to
 * avoid bloating the DB, but retain enough text for auditing/search.
 */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim()
}

export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY || ''
  const fromEmail = process.env.EMAIL_FROM || 'Alwaan <onboarding@resend.dev>'
  const replyTo = process.env.EMAIL_REPLY_TO || 'info@alwaan.ae'

  const plainBody = htmlToText(opts.html)
  const testMode = !apiKey || apiKey.trim() === ''

  let status: 'Sent' | 'Failed' | 'Queued' = 'Sent'
  let providerId = ''
  let errorMessage = ''

  try {
    if (testMode) {
      providerId = `test-mode-${Date.now()}`
      const preview = plainBody.slice(0, 240).replace(/\s+/g, ' ')
      // eslint-disable-next-line no-console
      console.log(
        `\n[EMAIL TEST MODE]\n  To:      ${opts.toName ? `${opts.toName} <${opts.to}>` : opts.to}\n  Subject: ${opts.subject}\n  Tmpl:    ${opts.template}\n  Preview: ${preview}${plainBody.length > 240 ? '…' : ''}\n`
      )
    } else {
      // Dynamically import Resend so environments without the key don't need the module at boot
      const { Resend } = await import('resend')
      const resend = new Resend(apiKey)
      const result = await resend.emails.send({
        from: fromEmail,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        replyTo,
      })

      const anyResult = result as { data?: { id?: string } | null; error?: { message?: string } | null }
      if (anyResult?.error) {
        status = 'Failed'
        errorMessage = anyResult.error.message || 'Unknown Resend error'
      } else {
        providerId = anyResult?.data?.id || ''
      }
    }
  } catch (err) {
    status = 'Failed'
    errorMessage = err instanceof Error ? err.message : String(err)
    // eslint-disable-next-line no-console
    console.error('[sendEmail] error:', errorMessage)
  }

  try {
    await prisma.emailLog.create({
      data: {
        organizationId: opts.organizationId,
        toEmail: opts.to,
        toName: opts.toName || '',
        fromEmail,
        subject: opts.subject,
        template: opts.template,
        body: plainBody,
        status,
        errorMessage,
        providerId,
        triggeredBy: opts.triggeredBy || '',
        refType: opts.refType || '',
        refId: opts.refId || '',
      },
    })
  } catch (logErr) {
    // eslint-disable-next-line no-console
    console.error('[sendEmail] failed to write EmailLog:', logErr)
  }

  if (status === 'Failed') {
    return { success: false, error: errorMessage }
  }
  return { success: true, messageId: providerId }
}
