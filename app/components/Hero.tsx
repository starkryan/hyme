"use client"
import React, { Suspense } from 'react'
import { Skeleton } from "@/components/ui/skeleton"

// import { Footerdemo } from './Footer'
// import  { Hero} from "@/components/ui/animated-hero"

import { FeaturesSectionWithHoverEffects } from './Features'
import { InfiniteSliderBasic } from './InfinitSlider'
// import { Footerdemo } from './Footer'
import { HeroDemo } from './Herodemo'

const LoadingSkeleton = () => {
  return (
    <div className="w-full space-y-8 animate-pulse">
      {/* Hero section skeleton */}
      <div className="h-[60vh] w-full">
        <Skeleton className="w-full h-full" />
      </div>
      
      {/* Features section skeleton */}
      <div className="container mx-auto px-4">
        <Skeleton className="h-8 w-1/3 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-lg" />
          ))}
        </div>
      </div>
      
      {/* Slider section skeleton */}
      <div className="w-full h-32">
        <Skeleton className="w-full h-full" />
      </div>
    </div>
  )
}

function Hero() {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-grow">
        <Suspense fallback={<LoadingSkeleton />}>
          {/* <Hero /> */}
          <HeroDemo />
          <InfiniteSliderBasic />
          <FeaturesSectionWithHoverEffects />
          
        </Suspense>
      </main>
      {/* <Footerdemo /> */}
    </div>
  )
}

export default Hero
