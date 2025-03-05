import * as React from "react"
import { cn } from "@/lib/utils"

interface ProgressIndicatorProps {
  value: number // Value between 0-100
  maxValue?: number
  className?: string
  showText?: boolean
  textPosition?: "inside" | "right"
  color?: "default" | "success" | "warning" | "danger"
  size?: "sm" | "md" | "lg"
  labelPrefix?: string
  labelSuffix?: string
}

export function ProgressIndicator({
  value,
  maxValue = 100,
  className,
  showText = true,
  textPosition = "right",
  color = "default",
  size = "md",
  labelPrefix = "",
  labelSuffix = "%"
}: ProgressIndicatorProps) {
  // Ensure value is between 0 and maxValue
  const normalizedValue = Math.max(0, Math.min(value, maxValue))
  const percentage = (normalizedValue / maxValue) * 100

  // Determine color based on value
  const getColorClasses = () => {
    if (color === "default") {
      // Auto color based on percentage
      if (percentage >= 80) return "bg-gradient-to-r from-green-500 to-emerald-500"
      if (percentage >= 60) return "bg-gradient-to-r from-green-400 to-green-500"
      if (percentage >= 40) return "bg-gradient-to-r from-yellow-500 to-orange-400"
      if (percentage >= 20) return "bg-gradient-to-r from-orange-500 to-red-400"
      return "bg-gradient-to-r from-red-500 to-rose-600"
    }
    
    switch (color) {
      case "success":
        return "bg-gradient-to-r from-green-500 to-emerald-500"
      case "warning":
        return "bg-gradient-to-r from-yellow-500 to-orange-400"
      case "danger":
        return "bg-gradient-to-r from-red-500 to-rose-600"
      default:
        return "bg-gradient-to-r from-blue-500 to-indigo-500"
    }
  }

  // Size classes
  const getSizeClasses = () => {
    switch (size) {
      case "sm": return "h-1.5 text-xs"
      case "lg": return "h-3 text-base"
      default: return "h-2 text-sm"
    }
  }

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <div className={cn("w-full bg-muted rounded-full overflow-hidden", getSizeClasses())}>
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300 ease-in-out", 
            getColorClasses(),
            textPosition === "inside" ? "flex items-center justify-end px-2" : ""
          )}
          style={{ width: `${percentage}%` }}
        >
          {showText && textPosition === "inside" && percentage > 15 && (
            <span className="text-white font-medium text-xs">
              {labelPrefix}{normalizedValue}{labelSuffix}
            </span>
          )}
        </div>
      </div>
      {showText && textPosition === "right" && (
        <span className="text-muted-foreground font-medium whitespace-nowrap">
          {labelPrefix}{normalizedValue}{labelSuffix}
        </span>
      )}
    </div>
  )
} 