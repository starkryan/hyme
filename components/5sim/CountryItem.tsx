import React from "react"
import { Check } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface Country {
  code: string
  name: string
  iso: string
  prefix: string
}

interface CountryItemProps {
  country: Country
  isSelected: boolean
  className?: string
}

const CountryFlag = ({ iso }: { iso: string }) => {
  // Convert ISO code to regional indicator symbols (emoji flag)
  const getFlagEmoji = (countryCode: string): string => {
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  };

  return (
    <span className="text-xl mr-2" role="img" aria-label="flag">
      {getFlagEmoji(iso)}
    </span>
  );
};

export function CountryItem({ 
  country, 
  isSelected, 
  className 
}: CountryItemProps) {
  // Format country name to be more readable (capitalize first letter)
  const formatCountryName = (name: string) => {
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
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
      
      {/* Country Flag and Name */}
      <div className="flex items-center flex-1 min-w-0">
        <CountryFlag iso={country.iso} />
        <span className="truncate capitalize">
          {formatCountryName(country.name)}
        </span>
      </div>
      
      {/* Country Code */}
      <div className="ml-auto shrink-0">
        <Badge 
          variant="secondary" 
          className="font-mono text-xs whitespace-nowrap"
        >
          {country.prefix}
        </Badge>
      </div>
    </div>
  )
} 