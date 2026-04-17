"use client"

import { useEffect, useRef, useState, useCallback } from 'react'
import { MessageSquare, Send, ArrowLeft, Paperclip, X as XIcon } from 'lucide-react'

interface Props {
  token: string
  contractNo: string
  version: number
  defaultName: string
  kind?: 'owner' | 'tenant'
}

type Mode = 'draw' | 'type'
type View = 'choose' | 'sign' | 'request'

export default function SignatureForm({ token, contractNo, version, defaultName, kind = 'owner' }: Props) {
  // Show signature panel immediately. "Request changes" is a small link at the bottom.
  const [view, setView] = useState<View>('sign')

  // ---- Tenant-only fields: EID front + back, family size, emergency contact
  const [eidFront, setEidFront] = useState<File | null>(null)
  const [eidBack, setEidBack] = useState<File | null>(null)
  const [eidError, setEidError] = useState<string>('')
  const [familySize, setFamilySize] = useState<number>(0)
  const [emergencyName, setEmergencyName] = useState<string>('')
  const [emergencyPhone, setEmergencyPhone] = useState<string>('')
  const [tenantNameAr, setTenantNameAr] = useState<string>('')
  const [tenantEidNumber, setTenantEidNumber] = useState<string>('')
  const [tenantEidExpiry, setTenantEidExpiry] = useState<string>('')
  const [tenantNationality, setTenantNationality] = useState<string>('')

  const validateEid = (file: File | null): string => {
    if (!file) return ''
    if (file.size > 5 * 1024 * 1024) return 'File must be 5 MB or smaller.'
    if (!/^(image\/(png|jpe?g|webp)|application\/pdf)$/i.test(file.type)) {
      return 'Only images (PNG/JPG/WebP) or PDF are allowed.'
    }
    return ''
  }
  const handleEidFront = (file: File | null) => {
    const err = validateEid(file)
    setEidError(err)
    if (!err) setEidFront(file)
  }
  const handleEidBack = (file: File | null) => {
    const err = validateEid(file)
    setEidError(err)
    if (!err) setEidBack(file)
  }

  // ---- Signing state
  const [mode, setMode] = useState<Mode>('draw')
  const [fullName, setFullName] = useState<string>(defaultName || '')
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)

  // ---- Change-request state
  const [changeNotes, setChangeNotes] = useState('')
  const [changeSubmitting, setChangeSubmitting] = useState(false)
  const [changeError, setChangeError] = useState('')
  const [changeSent, setChangeSent] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)

  // Initialize canvas
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = window.devicePixelRatio || 1
    const cssWidth = canvas.clientWidth
    const cssHeight = canvas.clientHeight
    canvas.width = cssWidth * ratio
    canvas.height = cssHeight * ratio
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, cssWidth, cssHeight)
    ctx.strokeStyle = '#111111'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  useEffect(() => {
    if (view !== 'sign') return
    initCanvas()
    const onResize = () => initCanvas()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [initCanvas, mode, view])

  useEffect(() => {
    if (view !== 'sign') return
    if (mode !== 'type') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    if (fullName.trim()) {
      ctx.fillStyle = '#111111'
      ctx.font = `italic 44px "Dancing Script", "Great Vibes", "Brush Script MT", cursive`
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'center'
      ctx.fillText(fullName, w / 2, h / 2)
      setHasDrawn(true)
    } else {
      setHasDrawn(false)
    }
  }, [mode, fullName, view])

  const getPoint = (e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    let clientX = 0
    let clientY = 0
    const native = ('nativeEvent' in e ? e.nativeEvent : e) as MouseEvent | TouchEvent
    if ('touches' in native && native.touches && native.touches.length > 0) {
      clientX = native.touches[0].clientX
      clientY = native.touches[0].clientY
    } else if ('changedTouches' in native && native.changedTouches && native.changedTouches.length > 0) {
      clientX = native.changedTouches[0].clientX
      clientY = native.changedTouches[0].clientY
    } else {
      clientX = (native as MouseEvent).clientX
      clientY = (native as MouseEvent).clientY
    }
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (mode !== 'draw') return
    e.preventDefault()
    drawingRef.current = true
    lastPointRef.current = getPoint(e)
  }

  const moveDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (mode !== 'draw' || !drawingRef.current) return
    e.preventDefault()
    const pt = getPoint(e)
    const last = lastPointRef.current
    const canvas = canvasRef.current
    if (!canvas || !pt || !last) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.beginPath()
    ctx.moveTo(last.x, last.y)
    ctx.lineTo(pt.x, pt.y)
    ctx.stroke()
    lastPointRef.current = pt
    setHasDrawn(true)
  }

  const endDraw = () => {
    drawingRef.current = false
    lastPointRef.current = null
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight)
    setHasDrawn(false)
  }

  // Tenant only types: name, emergency contact, family size. EID number is
  // filled by PM from the uploaded images, not by the tenant.
  const tenantFieldsValid =
    kind !== 'tenant' ||
    (familySize >= 0 &&
      emergencyName.trim().length >= 2 &&
      emergencyPhone.trim().length >= 6 &&
      !!eidFront &&
      !!eidBack)

  const canSubmit =
    !submitting &&
    fullName.trim().length >= 2 &&
    agreed &&
    hasDrawn &&
    tenantFieldsValid

  const handleSubmit = async () => {
    setError('')
    if (!canSubmit) return
    const canvas = canvasRef.current
    if (!canvas) return
    setSubmitting(true)
    try {
      const dataUrl = canvas.toDataURL('image/png')
      const res = await fetch(`/api/sign/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signatureImage: dataUrl,
          signedByName: fullName.trim(),
          agreed: true,
          familySize: kind === 'tenant' ? familySize : undefined,
          emergencyContactName: kind === 'tenant' ? emergencyName.trim() : undefined,
          emergencyContactPhone: kind === 'tenant' ? emergencyPhone.trim() : undefined,
          tenantNameAr: kind === 'tenant' ? tenantNameAr.trim() : undefined,
          tenantEidNumber:
            kind === 'tenant'
              ? tenantEidNumber.replace(/\s/g, '').replace(/(\d{3})(\d{4})(\d{7})(\d)/, '$1-$2-$3-$4')
              : undefined,
          tenantEidExpiry: kind === 'tenant' ? tenantEidExpiry : undefined,
          tenantNationality: kind === 'tenant' ? tenantNationality.trim() : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || `Request failed (${res.status})`)
      }

      // Upload EID front + back for OCR + verification.
      if (kind === 'tenant') {
        for (const [side, file] of [['front', eidFront], ['back', eidBack]] as const) {
          if (!file) continue
          try {
            const fd = new FormData()
            fd.append('file', file)
            fd.append('side', side)
            const up = await fetch(
              `/api/sign/${encodeURIComponent(token)}/upload`,
              { method: 'POST', body: fd }
            )
            if (!up.ok) {
              const upErr = await up.json().catch(() => ({}))
              console.warn(`EID ${side} upload failed:`, upErr?.error || up.status)
            }
          } catch (e) {
            console.warn(`EID ${side} upload error:`, e)
          }
        }
      }

      setSuccess(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit signature')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSendChanges = async () => {
    setChangeError('')
    const notes = changeNotes.trim()
    if (notes.length < 3) {
      setChangeError('Please describe what you would like changed.')
      return
    }
    setChangeSubmitting(true)
    try {
      const res = await fetch(
        `/api/sign/${encodeURIComponent(token)}/request-changes`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes }),
        }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || `Request failed (${res.status})`)
      }
      setChangeSent(true)
    } catch (e) {
      setChangeError(e instanceof Error ? e.message : 'Failed to send feedback')
    } finally {
      setChangeSubmitting(false)
    }
  }

  // ---- Post-sign success
  if (success) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-green-200 p-8 text-center">
        <div className="text-green-600 text-6xl mb-4">✓</div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-3">Thank You</h2>
        {kind === 'tenant' ? (
          <>
            <p className="text-gray-700 max-w-md mx-auto">
              Your signature has been recorded.
            </p>
            <p className="text-gray-700 max-w-md mx-auto mt-3">
              The Alwaan team will now review your documents and complete your
              tenancy setup. You&rsquo;ll receive a welcome email with your
              portal login credentials within <strong>24 hours</strong>.
            </p>
          </>
        ) : (
          <>
            <p className="text-gray-700 max-w-md mx-auto">
              Your signature has been recorded. Alwaan will counter-sign and send
              you the final copy.
            </p>
            <p className="text-gray-500 text-sm mt-4">
              A confirmation email has been sent to your registered address.
            </p>
          </>
        )}
      </div>
    )
  }

  // ---- Post-change-request success
  if (changeSent) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-amber-200 p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <MessageSquare className="h-7 w-7" />
        </div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-3">Feedback Sent</h2>
        <p className="text-gray-700 max-w-md mx-auto">
          Your feedback has been sent to Alwaan. They&rsquo;ll update the contract and send you
          a new version shortly.
        </p>
        <p className="text-gray-500 text-sm mt-4">
          You can close this page &mdash; no further action is needed right now.
        </p>
      </div>
    )
  }

  // ---- Choose view (primary entry point)
  if (view === 'choose') {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-2 text-center">
          Ready to proceed?
        </h2>
        <p className="text-sm text-gray-600 text-center mb-6">
          Please review the agreement above, then choose an option below.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setView('sign')}
            className="flex items-center justify-center gap-2 bg-[#E30613] hover:bg-[#b80510] text-white font-semibold py-4 px-6 rounded-lg shadow-md transition-colors"
          >
            <span className="text-lg leading-none">&#10003;</span>
            I Agree &amp; Sign
          </button>

          <button
            type="button"
            onClick={() => setView('request')}
            className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-4 px-6 rounded-lg shadow-md transition-colors"
          >
            <MessageSquare className="h-5 w-5" />
            Request Changes
          </button>
        </div>

        <p className="text-center text-xs text-gray-500 mt-5">
          Not sure about something? Choose &ldquo;Request Changes&rdquo; and tell us what to adjust &mdash;
          Alwaan will send you a revised version to review.
        </p>
      </div>
    )
  }

  // ---- Request Changes view
  if (view === 'request') {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-amber-200 p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <MessageSquare className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Request Changes</h2>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Tell us what you&rsquo;d like changed in this agreement. Be as specific as you can
          (e.g. the management fee, the start date, a particular clause). Alwaan will review your
          feedback, update the draft, and send you a new version to sign.
        </p>

        <label className="block mb-4">
          <span className="block text-sm font-medium text-gray-700 mb-1">
            Your feedback <span className="text-red-600">*</span>
          </span>
          <textarea
            value={changeNotes}
            onChange={(e) => setChangeNotes(e.target.value)}
            placeholder="For example: Please change the management fee from 5% to 4%, and move the start date to 1st of next month."
            rows={6}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none resize-y"
          />
          <span className="mt-1 block text-xs text-gray-400">
            Reference: {contractNo} v{version}
          </span>
        </label>

        {changeError && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            {changeError}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => { setView('choose'); setChangeError('') }}
            disabled={changeSubmitting}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSendChanges}
            disabled={changeSubmitting || changeNotes.trim().length < 3}
            className={`flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-semibold text-white transition-colors ${
              changeSubmitting || changeNotes.trim().length < 3
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-amber-500 hover:bg-amber-600 shadow-md'
            }`}
          >
            <Send className="h-4 w-4" />
            {changeSubmitting ? 'Sending…' : 'Send Feedback'}
          </button>
        </div>
      </div>
    )
  }

  // ---- Sign view
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-6">
      {/* Cursive font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@500;700&family=Great+Vibes&display=swap"
      />

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Sign This Agreement</h2>
        <button
          type="button"
          onClick={() => setView('choose')}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
      </div>

      {/* Full name */}
      <label className="block mb-4">
        <span className="block text-sm font-medium text-gray-700 mb-1">
          Full Legal Name <span className="text-red-600">*</span>
        </span>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Type your full name exactly as on your Emirates ID"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#E30613] focus:ring-2 focus:ring-[#E30613]/20 outline-none"
        />
      </label>

      {/* Tenant-only: identity + household + EID (required) */}
      {kind === 'tenant' && (
        <div className="mb-4 space-y-4">

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">
                Family Size <span className="text-red-600">*</span>
              </span>
              <input
                type="number"
                min={1}
                value={familySize || ''}
                onChange={(e) => setFamilySize(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">
                Emergency Contact Name <span className="text-red-600">*</span>
              </span>
              <input
                type="text"
                value={emergencyName}
                onChange={(e) => setEmergencyName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">
                Emergency Contact Phone <span className="text-red-600">*</span>
              </span>
              <input
                type="tel"
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value)}
                placeholder="+971 ..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
              />
            </label>
          </div>

          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-800 mb-2">
              Emirates ID <span className="text-red-600">*</span>
              <span className="ml-2 text-xs font-normal text-slate-500">
                Upload clear photos/scans of both sides
              </span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                { label: 'Front side', file: eidFront, set: handleEidFront },
                { label: 'Back side', file: eidBack, set: handleEidBack },
              ] as const).map((row) => (
                <div key={row.label} className="rounded-md bg-white border border-slate-200 p-3">
                  <p className="text-xs font-medium text-slate-700 mb-1.5">{row.label}</p>
                  {!row.file ? (
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => row.set(e.target.files?.[0] || null)}
                      className="block w-full text-xs text-slate-700 file:mr-2 file:rounded file:border-0 file:bg-[#E30613] file:px-2 file:py-1 file:text-xs file:font-semibold file:text-white hover:file:bg-[#b80510]"
                    />
                  ) : (
                    <div className="flex items-center justify-between text-xs text-slate-700">
                      <span className="truncate">
                        <Paperclip className="inline h-3 w-3 mr-1 text-slate-400" />
                        {row.file.name}
                        <span className="ml-1 text-slate-400">({(row.file.size / 1024).toFixed(0)} KB)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => row.set(null)}
                        className="text-slate-400 hover:text-[#E30613]"
                        aria-label="Remove"
                      >
                        <XIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {eidError && <p className="mt-2 text-xs text-[#E30613]">{eidError}</p>}
            <p className="mt-2 text-[11px] text-slate-500">
              We use this to auto-fill your legal name, ID number, expiry, and nationality
              on the contract. Accepted: JPG/PNG/WebP/PDF, max 5&nbsp;MB per file.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => { setMode('draw'); setHasDrawn(false); setTimeout(initCanvas, 0) }}
          className={`flex-1 sm:flex-none px-4 py-2 text-sm rounded-lg border transition-colors ${
            mode === 'draw'
              ? 'bg-[#E30613] text-white border-[#E30613]'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          ✍ Draw Signature
        </button>
        <button
          type="button"
          onClick={() => setMode('type')}
          className={`flex-1 sm:flex-none px-4 py-2 text-sm rounded-lg border transition-colors ${
            mode === 'type'
              ? 'bg-[#E30613] text-white border-[#E30613]'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          A Type Signature
        </button>
      </div>

      {/* Canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={400}
          height={150}
          style={{ width: '100%', height: 150, touchAction: 'none' }}
          className="w-full bg-white border border-gray-300 rounded-lg cursor-crosshair"
          onMouseDown={startDraw}
          onMouseMove={moveDraw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={moveDraw}
          onTouchEnd={endDraw}
        />
        {!hasDrawn && mode === 'draw' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-gray-300 text-sm select-none">
            Sign here with your mouse or finger
          </div>
        )}
        {!hasDrawn && mode === 'type' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-gray-300 text-sm select-none">
            Type your name above to generate a signature
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-2 mb-5">
        <button
          type="button"
          onClick={clearCanvas}
          className="text-xs text-gray-500 hover:text-red-600 underline"
          disabled={mode === 'type'}
        >
          Clear
        </button>
        <span className="text-xs text-gray-400">
          {mode === 'draw' ? 'Use mouse or touchscreen' : 'Cursive rendering'}
        </span>
      </div>

      {/* Agreement checkbox */}
      <label className="flex items-start gap-3 mb-5 p-4 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 h-4 w-4 text-[#E30613] focus:ring-[#E30613] border-gray-300 rounded"
        />
        <span className="text-sm text-gray-700 leading-relaxed">
          I have read and agree to all terms of this Property Management Agreement.
          <span dir="rtl" className="block mt-1 text-gray-600">
            لقد قرأت ووافقت على جميع شروط هذه الاتفاقية
          </span>
        </span>
      </label>

      {/* Capture notice */}
      <div className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg p-3 mb-5">
        <strong>Legal notice:</strong> By signing, you consent to the use of electronic signatures.
        The following will be recorded with your signature:
        <ul className="list-disc ml-5 mt-1 space-y-0.5">
          <li>Agreement reference: <span className="font-mono">{contractNo} v{version}</span></li>
          <li>Date and time of signing</li>
        </ul>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-colors ${
          canSubmit
            ? 'bg-[#E30613] hover:bg-[#b80510] shadow-md'
            : 'bg-gray-300 cursor-not-allowed'
        }`}
      >
        {submitting ? 'Submitting…' : 'Submit Signature'}
      </button>

      {!canSubmit && !submitting && (
        <p className="text-center text-xs text-amber-700 mt-2">
          {fullName.trim().length < 2
            ? 'Enter your full name to continue.'
            : kind === 'tenant' && emergencyName.trim().length < 2
            ? 'Enter an emergency contact name.'
            : kind === 'tenant' && emergencyPhone.trim().length < 6
            ? 'Enter an emergency contact phone.'
            : kind === 'tenant' && !eidFront
            ? 'Upload your Emirates ID — front side.'
            : kind === 'tenant' && !eidBack
            ? 'Upload your Emirates ID — back side.'
            : !hasDrawn
            ? 'Add your signature above (draw or type).'
            : !agreed
            ? 'Please tick the box to confirm you agree to the terms.'
            : ''}
        </p>
      )}

      <div className="mt-5 pt-4 border-t border-gray-100 text-center">
        <button
          type="button"
          onClick={() => setView('request')}
          className="text-sm text-amber-700 hover:text-amber-800 underline inline-flex items-center gap-1"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Actually, I&rsquo;d like to request changes instead
        </button>
      </div>
    </div>
  )
}
