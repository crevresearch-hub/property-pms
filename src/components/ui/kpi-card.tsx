import { cn } from "@/lib/utils"

const colorMap = {
  gold: {
    border: "border-t-amber-500",
    icon: "text-amber-600",
    bg: "bg-amber-500/10",
  },
  green: {
    border: "border-t-emerald-500",
    icon: "text-emerald-600",
    bg: "bg-emerald-500/10",
  },
  red: {
    border: "border-t-[#E30613]",
    icon: "text-[#E30613]",
    bg: "bg-[#E30613]/10",
  },
  blue: {
    border: "border-t-[#E30613]",
    icon: "text-[#E30613]",
    bg: "bg-[#E30613]/10",
  },
  amber: {
    border: "border-t-amber-500",
    icon: "text-amber-600",
    bg: "bg-amber-500/10",
  },
  purple: {
    border: "border-t-purple-500",
    icon: "text-purple-600",
    bg: "bg-purple-500/10",
  },
} as const

type KpiColor = keyof typeof colorMap

interface KpiCardProps {
  label: string
  value: string | number
  subtitle?: string
  color?: KpiColor
  icon?: React.ReactNode
  className?: string
}

export function KpiCard({
  label,
  value,
  subtitle,
  color = "gold",
  icon,
  className,
}: KpiCardProps) {
  const scheme = colorMap[color]

  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-5 border-t-2 shadow-sm transition-all hover:shadow-md",
        scheme.border,
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
          {subtitle && (
            <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
              scheme.bg
            )}
          >
            <div className={scheme.icon}>{icon}</div>
          </div>
        )}
      </div>
    </div>
  )
}
