import React from "react"
import { Check, Info, Star } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ProgressIndicator } from "@/components/ui/progress-indicator"
import { cn } from "@/lib/utils"
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger 
} from "@/components/ui/tooltip"
import { TooltipContent as CustomTooltipContent } from "@/components/ui/tooltip-content"

interface Operator {
  id: string
  name: string
  displayName: string
  cost: number
  count: number
  rate: number
}

interface OperatorItemProps {
  operator: Operator
  isSelected: boolean
  convertToINR: (cost: number) => number
  className?: string
}

export function OperatorItem({ 
  operator, 
  isSelected, 
  convertToINR, 
  className 
}: OperatorItemProps) {
  // Determine success rate color and variant
  const getRateColor = (rate: number) => {
    if (rate >= 90) return "success"
    if (rate >= 70) return "default"
    if (rate >= 50) return "warning"
    return "danger"
  }

  // Format price with correct currency symbol and decimals
  const formatPrice = (price: number) => {
    return `₹${price.toFixed(2)}`
  }

  return (
    <div className={cn(
      "flex items-center w-full group transition-all",
      isSelected && "font-medium",
      className
    )}>
      {/* Selection check */}
      <Check
        className={cn(
          "mr-2 h-4 w-4 shrink-0 transition-opacity",
          isSelected ? "opacity-100" : "opacity-0"
        )}
      />
      
      {/* Operator Name */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="capitalize truncate">{operator.displayName}</span>
          {operator.rate >= 95 && (
            <Star 
              className="h-3.5 w-3.5 fill-amber-400 text-amber-400" 
              aria-label="High quality provider" 
            />
          )}
        </div>
      </div>
      
      {/* Metadata */}
      <div className="ml-auto flex items-center gap-2 shrink-0">
        {/* Success Rate Indicator */}
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger className="cursor-default flex items-center">
              <div className="w-20">
                <ProgressIndicator 
                  value={operator.rate} 
                  size="sm"
                  showText
                  textPosition="right"
                  color={getRateColor(operator.rate)}
                  className="mr-1"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={5}>
              <CustomTooltipContent 
                title="Success Rate" 
                variant={operator.rate >= 85 ? "success" : "info"}
              >
                <p>This provider has a <strong>{operator.rate}%</strong> success rate</p>
                <p className="text-xs mt-1 text-muted-foreground">
                  Higher rates indicate better reliability for receiving SMS codes
                </p>
              </CustomTooltipContent>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        {/* Price Badge */}
        <Badge 
          variant="secondary" 
          className={cn(
            "font-mono text-xs whitespace-nowrap",
            "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
          )}
        >
          {formatPrice(convertToINR(operator.cost))}
        </Badge>
      </div>
    </div>
  )
} 