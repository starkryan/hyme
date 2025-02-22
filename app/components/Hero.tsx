"use client"
import React from 'react'

import { Footerdemo } from './Footer'
import { HeroGeometric } from './Shape-landing'
import { FeaturesSectionWithHoverEffects } from './Features'
import { Home, User, Briefcase, FileText, LucideIcon } from 'lucide-react'
import { InfiniteSliderBasic } from './InfinitSlider'


function Hero() {
 

  return (
    <div className="min-h-screen flex flex-col">
    
      <main className="flex-grow">
      
        <HeroGeometric />
        <FeaturesSectionWithHoverEffects />
        <InfiniteSliderBasic />
      
      </main>
      <Footerdemo />
    </div>
  )
}

export default Hero
