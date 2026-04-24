"use client"

import { useEffect, useState } from "react"
import { Sun, Moon } from "lucide-react"

type Theme = "dark" | "light"

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark"
  const stored = window.localStorage.getItem("theme") as Theme | null
  if (stored === "light" || stored === "dark") return stored
  // Respect OS preference on first visit.
  if (window.matchMedia?.("(prefers-color-scheme: light)").matches) return "light"
  return "dark"
}

function applyTheme(t: Theme) {
  if (typeof document === "undefined") return
  document.documentElement.setAttribute("data-theme", t)
  document.documentElement.style.colorScheme = t
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = readStoredTheme()
    setTheme(t)
    applyTheme(t)
    setMounted(true)
  }, [])

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark"
    setTheme(next)
    applyTheme(next)
    try { window.localStorage.setItem("theme", next) } catch {}
  }

  // Avoid SSR/CSR flash: render a placeholder of same size before mount.
  if (!mounted) return <button className="h-9 w-9 rounded-lg" aria-label="Theme" />

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
    >
      {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  )
}
