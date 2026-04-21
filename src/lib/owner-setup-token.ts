import crypto from 'crypto'

const ENCODER = new TextEncoder()

function b64url(buf: Buffer | Uint8Array): string {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

function getSecret(): string {
  return process.env.NEXTAUTH_SECRET || 'fallback-insecure-dev-secret'
}

export function signOwnerSetupToken(ownerId: string, expiresInHours = 72): string {
  const payload = { id: ownerId, exp: Math.floor(Date.now() / 1000) + expiresInHours * 3600 }
  const payloadB64 = b64url(Buffer.from(JSON.stringify(payload)))
  const sig = crypto.createHmac('sha256', getSecret()).update(payloadB64).digest()
  return `${payloadB64}.${b64url(sig)}`
}

export function verifyOwnerSetupToken(token: string): { valid: boolean; ownerId?: string; reason?: string } {
  try {
    const [payloadB64, sigB64] = token.split('.')
    if (!payloadB64 || !sigB64) return { valid: false, reason: 'Malformed token' }
    const expectedSig = crypto.createHmac('sha256', getSecret()).update(payloadB64).digest()
    const gotSig = b64urlDecode(sigB64)
    if (expectedSig.length !== gotSig.length || !crypto.timingSafeEqual(expectedSig, gotSig)) {
      return { valid: false, reason: 'Invalid signature' }
    }
    const payload = JSON.parse(b64urlDecode(payloadB64).toString('utf8')) as { id: string; exp: number }
    if (!payload.id) return { valid: false, reason: 'No owner id' }
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false, reason: 'Token expired' }
    }
    return { valid: true, ownerId: payload.id }
  } catch {
    return { valid: false, reason: 'Verification failed' }
  }
}

// keep encoder happy for any tree-shake check
void ENCODER
