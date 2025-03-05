import * as React from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"

interface TooltipContentProps {
  title?: string
  children: React.ReactNode
  className?: string
  align?: "left" | "center" | "right"
  variant?: "default" | "info" | "success" | "warning" | "danger"
}

export function TooltipContent({
  title,
  children,
  className,
  align = "left",
  variant = "default"
}: TooltipContentProps) {
  const getVariantClasses = () => {
    switch (variant) {
      case "info":
        return "bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800/60"
      case "success":
        return "bg-green-50 border-green-200 dark:bg-green-950/40 dark:border-green-800/60"
      case "warning":
        return "bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800/60"
      case "danger":
        return "bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-800/60"
      default:
        return "bg-card border-border"
    }
  }

  const getTextAlignClass = () => {
    switch (align) {
      case "center": return "text-center"
      case "right": return "text-right"
      default: return "text-left"
    }
  }

  return (
    <Card className={cn(
      "shadow-md border", 
      getVariantClasses(),
      className
    )}>
      {title && (
        <div className={cn(
          "px-3 py-1.5 border-b font-medium text-sm", 
          getTextAlignClass()
        )}>
          {title}
        </div>
      )}
      <CardContent className={cn(
        "p-3 text-sm", 
        getTextAlignClass()
      )}>
        {children}
      </CardContent>
    </Card>
  )
} 