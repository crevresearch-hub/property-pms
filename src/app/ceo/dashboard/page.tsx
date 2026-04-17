"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function CeoDashboardRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace("/ceo/alwaan") }, [router])
  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#E30613] border-t-transparent" />
    </div>
  )
}
