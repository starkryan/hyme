"use client"
import React, { Suspense } from 'react'
import { Skeleton } from "@/components/ui/skeleton"

// import { Footerdemo } from './Footer'
// import  { Hero} from "@/components/ui/animated-hero"

import { FeaturesSectionWithHoverEffects } from './Features'
// import { InfiniteSliderBasic } from './InfinitSlider'
// import { Footerdemo } from './Footer'
import { HeroDemo } from './Herodemo'
// import { Marquee } from '@/components/magicui/marquee'
import Review from './Review'

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
    <div className="w-full">
      <main className="w-full">
        <Suspense fallback={<LoadingSkeleton />}>
          {/* <Hero /> */}
          <HeroDemo />
          {/* <InfiniteSliderBasic /> */}
          <FeaturesSectionWithHoverEffects />
          <h1 className='text-center text-2xl font-bold'>Our Customer Reviews</h1>
          <Review />
          
        </Suspense>
      </main>
      {/* <Footerdemo /> */}
    </div>
  )
}

export default Hero
