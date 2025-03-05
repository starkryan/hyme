import React from "react"
import { Check } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger 
} from "@/components/ui/tooltip"
import { TooltipContent as CustomTooltipContent } from "@/components/ui/tooltip-content"

interface Product {
  id: string
  name: string
  category: string
  price: number
  quantity: number
}

interface ProductItemProps {
  product: Product
  isSelected: boolean
  className?: string
}

export function ProductItem({ 
  product, 
  isSelected, 
  className 
}: ProductItemProps) {
  // Determine availability status
  const getAvailabilityStatus = (quantity: number) => {
    if (quantity > 1000) return { label: "High Availability", variant: "success" }
    if (quantity > 500) return { label: "Good Availability", variant: "success" }
    if (quantity > 100) return { label: "Limited Availability", variant: "warning" }
    return { label: "Low Availability", variant: "danger" }
  }

  const availabilityStatus = getAvailabilityStatus(product.quantity)

  // Format product name to be more readable
  const formatProductName = (name: string) => {
    return name.replace(/_/g, " ")
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
      
      {/* Product Name */}
      <div className="flex-1 min-w-0">
        <span className="truncate">{formatProductName(product.name)}</span>
      </div>
      
      {/* Availability Badge */}
      <div className="ml-auto shrink-0">
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                variant="secondary" 
                className={cn(
                  "font-mono text-xs whitespace-nowrap",
                  product.quantity < 500 
                    ? "bg-destructive/10 text-destructive hover:bg-destructive/20" 
                    : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                )}
              >
                {product.quantity} avl
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={5}>
              <CustomTooltipContent 
                title="Availability" 
                variant={product.quantity > 500 ? "success" : "warning"}
              >
                <p>{availabilityStatus.label}</p>
                <p className="text-xs mt-1 text-muted-foreground">
                  {product.quantity} numbers currently available
                </p>
              </CustomTooltipContent>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  )
} 