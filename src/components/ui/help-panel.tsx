"use client"

import { useState } from "react"
import { HelpCircle, X } from "lucide-react"

interface HelpSection {
  title: string
  body: React.ReactNode
}

export function HelpPanel({
  title,
  sections,
}: {
  title: string
  sections: HelpSection[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white"
        title="What does this page do?"
      >
        <HelpCircle className="h-3.5 w-3.5" /> Help
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
          <div className="mt-12 w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
            {/* Red accent */}
            <div className="h-1 w-full bg-[#E30613] rounded-t-xl" />

            <div className="flex items-center justify-between border-b border-slate-800 bg-gradient-to-r from-[#1a1a1a] to-[#0a0a0a] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E30613]/20">
                  <HelpCircle className="h-5 w-5 text-[#E30613]" />
                </div>
                <h2 className="text-lg font-bold text-white">{title}</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto px-6 py-5 space-y-5">
              {sections.map((s, i) => (
                <section key={i}>
                  <h3 className="mb-2 text-sm font-semibold text-amber-400 uppercase tracking-wide">
                    {s.title}
                  </h3>
                  <div className="text-sm text-slate-300 leading-relaxed space-y-2">
                    {s.body}
                  </div>
                </section>
              ))}
            </div>

            <div className="border-t border-slate-800 bg-slate-950/50 px-6 py-3 text-right">
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg bg-[#E30613] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#c20510]"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
