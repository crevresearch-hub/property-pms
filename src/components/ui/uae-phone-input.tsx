"use client"

import { forwardRef } from "react"

// Strip every non-digit and return the 9-digit UAE local number (without leading 0 / +971).
// Accepts any of: "0501234567", "501234567", "+971501234567", "00971501234567".
export function normalizeUaeLocal(input: string): string {
  const digits = input.replace(/\D/g, "")
  if (digits.startsWith("00971")) return digits.slice(5, 14)
  if (digits.startsWith("971")) return digits.slice(3, 12)
  if (digits.startsWith("0")) return digits.slice(1, 10)
  return digits.slice(0, 9)
}

// Format a UAE local 9-digit number as "+971 5X XXX XXXX" (mobile) or "+971 X XXX XXXX" (landline).
export function formatUaePhone(local: string): string {
  const d = normalizeUaeLocal(local)
  if (!d) return ""
  if (d.startsWith("5")) {
    // Mobile: 2 + 3 + 4 digits after the prefix
    const a = d.slice(0, 2)
    const b = d.slice(2, 5)
    const c = d.slice(5, 9)
    return ["+971", a, b, c].filter(Boolean).join(" ").trim()
  }
  // Landline: 1 + 3 + 4 digits
  const a = d.slice(0, 1)
  const b = d.slice(1, 4)
  const c = d.slice(4, 8)
  return ["+971", a, b, c].filter(Boolean).join(" ").trim()
}

// Always store E.164 form ("+971501234567") — safer for DB & SMS APIs.
export function toE164(local: string): string {
  const d = normalizeUaeLocal(local)
  return d ? `+971${d}` : ""
}

// Validate: must be 9 digits; mobile starts with 5, landline starts with 2/3/4/6/7/9.
export function isValidUaePhone(local: string): boolean {
  const d = normalizeUaeLocal(local)
  if (d.length !== 9) return false
  if (d.startsWith("5")) return d.length === 9
  return /^[234679]/.test(d) && d.length === 9
}

interface Props {
  value: string
  onChange: (e164: string) => void
  className?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  id?: string
  name?: string
  autoFocus?: boolean
}

// Controlled UAE phone input with fixed "+971" prefix. Always emits E.164 ("+971…").
export const UaePhoneInput = forwardRef<HTMLInputElement, Props>(function UaePhoneInput(
  { value, onChange, className, placeholder = "50 123 4567", required, disabled, id, name, autoFocus },
  ref
) {
  const local = normalizeUaeLocal(value)
  // Visual mask (without the "+971 " prefix which the flag span shows).
  const masked = (() => {
    if (!local) return ""
    if (local.startsWith("5")) {
      const a = local.slice(0, 2)
      const b = local.slice(2, 5)
      const c = local.slice(5, 9)
      return [a, b, c].filter(Boolean).join(" ")
    }
    const a = local.slice(0, 1)
    const b = local.slice(1, 4)
    const c = local.slice(4, 8)
    return [a, b, c].filter(Boolean).join(" ")
  })()
  const valid = !local || isValidUaePhone(local)

  return (
    <div className="relative">
      <div className="flex items-stretch">
        <span
          className={
            "inline-flex select-none items-center gap-1 rounded-l-lg border border-r-0 px-3 text-sm font-semibold " +
            (disabled
              ? "border-slate-200 bg-slate-100 text-slate-400"
              : "border-slate-300 bg-slate-50 text-slate-700")
          }
          aria-hidden="true"
        >
          <span role="img" aria-label="UAE flag">🇦🇪</span> +971
        </span>
        <input
          ref={ref}
          id={id}
          name={name}
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          dir="ltr"
          autoFocus={autoFocus}
          value={masked}
          onChange={(e) => onChange(toE164(e.target.value))}
          onKeyDown={(e) => {
            // Allow: digits, space, backspace, delete, arrows, tab
            if (
              /^[0-9]$/.test(e.key) ||
              ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", " "].includes(e.key) ||
              (e.ctrlKey || e.metaKey)
            ) return
            e.preventDefault()
          }}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          maxLength={13} // "XX XXX XXXX" = 11 digits + 2 spaces
          className={
            (className || "") +
            " rounded-l-none rounded-r-lg " +
            (!valid ? "border-red-400 focus:border-red-500" : "")
          }
        />
      </div>
      {!valid && local.length > 0 && (
        <p className="mt-1 text-[11px] text-red-600">
          Enter a valid UAE number (9 digits after +971, mobile starts with 5).
        </p>
      )}
    </div>
  )
})
