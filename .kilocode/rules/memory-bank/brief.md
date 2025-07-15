# DezTehUg Project Brief

## Project Overview

**DezTehUg** (ДЕЗТЕХЮГ) is a modern professional sanitation service website with unique cyberpunk design and tagline "Future disinfection today". The project is a full-featured Next.js site combining futuristic aesthetics with practical business logic for disinfection services.

The site offers four core services: disinfection (virus & bacteria elimination with 99.9% effectiveness), pest control (insect extermination), deratization (rodent elimination), and water analysis (laboratory quality diagnostics). Each service has detailed structure with problem descriptions, solutions, and call-to-actions.

## Key Features

### 1. **Cyberpunk Design System**
Unique visual concept with neon effects, poison-green (#39FF14) and orange (#FF6B35) accents, futuristic fonts (Orbitron), and animated elements. Includes custom cyberpunk components: [`CyberpunkButton`](components/cyberpunk/CyberpunkButton.tsx), [`CyberpunkCard`](components/cyberpunk/CyberpunkCard.tsx), [`NeonInput`](components/cyberpunk/NeonInput.tsx).

### 2. **Modern Next.js 13+ Architecture**
Uses App Router, full TypeScript typing, component structure with clear separation of concerns. Integrated Tailwind CSS, Shadcn/ui, Framer Motion for animations, and Lucide React for icons.

### 3. **Structured Data System**
Typed structure for services ([`types/services.ts`](types/services.ts)) and SEO ([`types/seo.ts`](types/seo.ts)), centralized data storage in [`data/services/`](data/services/) and [`data/seo/`](data/seo/), uniform service page structure.

### 4. **Comprehensive Icon System**
Specialized components for different icon types: [`ServiceIcon`](components/ServiceIcon.tsx) (services), [`TrustFactorIcon`](components/TrustFactorIcon.tsx) (trust factors), [`WhyChooseUsIcon`](components/WhyChooseUsIcon.tsx) (advantages). SVG icons organized in [`public/icons/`](public/icons/) by categories.

### 5. **Modular Component Architecture**
Layout components ([`Header`](components/layout/Header.tsx), [`Footer`](components/layout/Footer.tsx), [`BrandLogo`](components/layout/BrandLogo.tsx)), service components ([`HeroSection`](components/services/HeroSection.tsx), [`ProblemSection`](components/services/ProblemSection.tsx), [`SolutionSection`](components/services/SolutionSection.tsx)), UI components from Shadcn/ui.

### 6. **SEO Optimization**
Complete metadata setup for each service, Open Graph for social networks, structured data, optimized titles and descriptions in Russian.

### 7. **Interactive Elements**
Service cost calculator ([`app/calculator/page.tsx`](app/calculator/page.tsx)), animated particles ([`FloatingParticles`](components/FloatingParticles.tsx)), responsive mobile menu, hover and transition effects.

## Tech Stack

- **Framework**: Next.js 13.5.1 (App Router)
- **Language**: TypeScript 5.2.2  
- **Styling**: Tailwind CSS 3.3.3
- **UI Components**: Shadcn/ui + Radix UI
- **Animations**: Framer Motion 11.5.4
- **Icons**: Lucide React 0.446.0
- **Fonts**: Inter (primary), Orbitron (cyberpunk headers)

## Current Development Status

**Status**: Active development (version 0.1.0)
**Dev server**: Running (`npm run dev`)
**Last update**: January 9, 2025, 5:21 PM (UTC+3)

### In Development:
- **Footer component** - final optimization [`Footer`](components/layout/Footer.tsx)
- **Component testing** - 7 test-*.html files for functionality verification
- **Performance optimization** - analysis and loading improvements
- **Project cleanup** - removing temporary files and structure optimization

### Completed:
- ✅ **Light theme adaptation for all service pages** - complete adaptation of all service pages (disinfection, pest-control, deratization, water-analysis) while preserving cyberpunk aesthetics
- ✅ **HeroSection component light theme** - complete adaptation with text color optimization for light backgrounds
- ✅ **Memory bank system** - complete documentation system with context tracking
- ✅ **Context.md creation** - critical memory bank file created and integrated
- ✅ **TrustFactorIcon component** - completed implementation with cyberpunk styling
- ✅ **WhyChooseUsIcon component** - completed implementation with dynamic SVG checking and Lucide React fallback
- ✅ **SVG icons** - created and organized all icons in [`public/icons/`](public/icons/)
- ✅ **Cyberpunk Footer design** - implemented with cyber grid background
- Basic project architecture and file structure
- Main service pages with complete content
- Cyberpunk design system and components
- SEO settings and metadata
- Typing system and data

## Priority Tasks

### Short-term (1-2 weeks):
1. **Footer refinement** - complete cyberpunk footer styling
2. **Component testing** - verify all elements on various devices
3. **Test file cleanup** - remove temporary test-*.html files
4. **TypeScript optimization** - configure tsconfig and fix warnings
5. **Performance optimization** - improve loading speed after light theme completion

### Medium-term (1-2 months):
1. **Add real contacts** - replace placeholders with actual data
2. **Form integration** - connect feedback and request forms
3. **Performance optimization** - improve loading speed
4. **Calculator functionality expansion** - add new parameters

### Long-term (3-6 months):
1. **CRM integration** - connect customer management system
2. **Online chat** - add instant messaging system
3. **Review system** - customer feedback module
4. **Blog/news** - content section of the site

---

*Last updated: January 9, 2025, 5:21 PM (UTC+3)*
*Version: 1.5.0*
*Project status: Active development*