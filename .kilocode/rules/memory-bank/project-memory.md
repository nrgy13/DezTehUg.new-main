# DezTehUg Project Memory Bank

## Project Overview

### Basic Information
- **Name**: DezTehUg (ДЕЗТЕХЮГ)
- **Full name**: "Future disinfection today"
- **Type**: Next.js website with cyberpunk design
- **Version**: 0.1.0
- **Language**: Russian (ru)

### Core Services
1. **Disinfection** - Virus & bacteria elimination (99.9% effectiveness against COVID-19, flu)
2. **Pest Control** - Total insect extermination (cockroaches, bedbugs, ants)
3. **Deratization** - Complete rodent elimination (rats, mice)
4. **Water Analysis** - Laboratory quality diagnostics (24 indicators in 48 hours)

### Tech Stack
- **Framework**: Next.js 13.5.1 (App Router)
- **Language**: TypeScript 5.2.2
- **Styling**: Tailwind CSS 3.3.3
- **UI Components**: Shadcn/ui + Radix UI
- **Animations**: Framer Motion 11.5.4
- **Icons**: Lucide React 0.446.0
- **Fonts**: Inter, Orbitron (cyberpunk style)

## Project Structure

### Architecture
- **App Router** - modern Next.js 13+ architecture
- **Component structure** with clear separation of concerns
- **Cyberpunk design system** with custom components
- **Typed structure** for services and SEO

### Main Directories
```
app/                    # App Router pages
├── globals.css        # Global styles
├── layout.tsx         # Root layout
├── page.tsx           # Main page
├── about/             # About company
├── calculator/        # Cost calculator
└── services/          # Service pages
    ├── layout.tsx
    ├── page.tsx
    ├── deratization/
    ├── disinfection/
    ├── pest-control/
    └── water-analysis/

components/             # React components
├── cyberpunk/         # Cyberpunk UI components
├── layout/            # Layout components
├── services/          # Service components
└── ui/                # Shadcn/ui components

data/                  # Application data
├── services/          # Service data
└── seo/              # SEO data

public/icons/          # SVG icons
├── services/         # Service icons
├── trust-factors/    # Trust factor icons
└── why-choose-us/    # Advantage icons

types/                 # TypeScript types
```

## Key Components

### Layout Components
- **[`AppWrapper`](components/layout/AppWrapper.tsx)** - Root wrapper with loading context
- **[`Header`](components/layout/Header.tsx)** - Navigation header with mobile menu
- **[`Footer`](components/layout/Footer.tsx)** - Site footer
- **[`BrandLogo`](components/layout/BrandLogo.tsx)** - Company logo
- **[`LogoText`](components/layout/LogoText.tsx)** - Text logo

### Cyberpunk UI Components
- **[`CyberpunkButton`](components/cyberpunk/CyberpunkButton.tsx)** - Styled buttons (primary, secondary, outline, ghost, cyber)
- **[`CyberpunkCard`](components/cyberpunk/CyberpunkCard.tsx)** - Cards with cyberpunk effects
- **[`CyberpunkProgressBar`](components/cyberpunk/CyberpunkProgressBar.tsx)** - Progress bars
- **[`NeonInput`](components/cyberpunk/NeonInput.tsx)** - Input fields with neon effects

### Service Components
- **[`HeroSection`](components/services/HeroSection.tsx)** - Service hero section
- **[`ProblemSection`](components/services/ProblemSection.tsx)** - Problem section
- **[`SolutionSection`](components/services/SolutionSection.tsx)** - Solution section
- **[`CTASection`](components/services/CTASection.tsx)** - Call-to-action sections
- **[`FinalCTASection`](components/services/FinalCTASection.tsx)** - Final call-to-action

### Icons and UI
- **[`ServiceIcon`](components/ServiceIcon.tsx)** - Service icons (bug, spray, rat, beaker)
- **[`TrustFactorIcon`](components/TrustFactorIcon.tsx)** - Trust factor icons (award, zap, clock)
- **[`WhyChooseUsIcon`](components/WhyChooseUsIcon.tsx)** - Advantage icons (award, check-circle, clock, cycle, shield, zap)
- **[`FloatingParticles`](components/FloatingParticles.tsx)** - Animated particles

## Design System

### Color Palette
```css
/* Main cyberpunk colors */
--poison-green: #39FF14      /* Poison green */
--neon-orange: #FF6B35       /* Neon orange */
--cyber-blue: #1E40AF        /* Cyber blue */
--electric-blue: #0EA5E9     /* Electric blue */

/* Content colors */
--content-primary: #1E293B   /* Primary text */
--content-secondary: #475569 /* Secondary text */
--content-muted: #64748B     /* Muted text */

/* Background colors */
--bg-primary: #FFFFFF        /* Primary background */
--bg-secondary: #F8FAFC      /* Secondary background */
--bg-tertiary: #F1F5F9       /* Tertiary background */
```

### Typography
- **Orbitron** - main cyberpunk font for headers
- **Inter** - main font for text
- **Space Mono, JetBrains Mono** - monospace fonts
- **Bebas Neue, Oswald** - additional fonts

### Animations
- **pulse-light** - pulsing glow
- **float** - floating elements
- **glow** - glow effect
- **cyberpunk** - shadows with neon effects

## Current State

### Active Processes
- **Dev server**: `npm run dev` running (Terminal 1)
- **Port**: localhost:3000 (presumably)
- **Last check**: January 9, 2025, 5:21 PM (UTC+3)

### Files in Development
- **Test HTML files** for component testing (7 files):
  - [`test-footer.html`](test-footer.html) - Footer component testing
  - [`test-footer-contact.html`](test-footer-contact.html) - Footer contact section testing
  - [`test-footer-contact-updated.html`](test-footer-contact-updated.html) - Updated contact version
  - [`test-footer-cyber-grid.html`](test-footer-cyber-grid.html) - Cyber grid background testing
  - [`test-grid-comparison.html`](test-grid-comparison.html) - Grid pattern comparison
  - [`test-service-icons.html`](test-service-icons.html) - Service icons testing
  - [`test-trust-factors-icons.html`](test-trust-factors-icons.html) - Trust factor icons testing

### New Configuration Files
- **[`next-env.d.ts`](next-env.d.ts)** - TypeScript definitions for Next.js
- **[`tsconfig.tsbuildinfo`](tsconfig.tsbuildinfo)** - TypeScript compiler cache

### Icon Components
- **[`TrustFactorIcon`](components/TrustFactorIcon.tsx)** - **COMPLETED**
  - Supports 3 icon types: award, zap, clock
  - Uses CSS filters for cyberpunk colors
  - Static implementation with direct SVG paths
- **[`WhyChooseUsIcon`](components/WhyChooseUsIcon.tsx)** - **COMPLETED**
  - Supports 6 icon types: shield, zap, award, check-circle, clock, cycle
  - Dynamic SVG file existence checking via fetch API
  - Fallback to Lucide React icons when SVG missing
  - Uses Next.js Image component for optimization
  - Implemented with useState and useEffect for async checking
- **SVG icons**: Created and placed in [`public/icons/`](public/icons/) by categories
  - [`public/icons/trust-factors/`](public/icons/trust-factors/) - 3 icons (award, zap, clock)
  - [`public/icons/why-choose-us/`](public/icons/why-choose-us/) - 6 icons (award, check-circle, clock, cycle, shield, zap)

### Footer Component
- **[`Footer`](components/layout/Footer.tsx)** - **ACTIVE REFINEMENT**
  - Implemented cyberpunk design with cyber grid background
  - Added geometric background elements
  - Centered layout for all sections
  - Integrated trust indicators and social networks
  - Status: Requires final optimization and testing

## Important Files

### Configuration
- **[`package.json`](package.json)** - Project dependencies and scripts
- **[`tailwind.config.ts`](tailwind.config.ts)** - Tailwind CSS config with cyberpunk theme
- **[`tsconfig.json`](tsconfig.json)** - TypeScript configuration
- **[`next.config.js`](next.config.js)** - Next.js configuration

### Types and Data
- **[`types/services.ts`](types/services.ts)** - Types for service structure
- **[`types/seo.ts`](types/seo.ts)** - Types for SEO data
- **[`data/services/`](data/services/)** - All service data
- **[`data/seo/`](data/seo/)** - SEO data for each service

### Main Pages
- **[`app/layout.tsx`](app/layout.tsx)** - Root layout with metadata
- **[`app/page.tsx`](app/page.tsx)** - Main page with hero section
- **[`app/calculator/page.tsx`](app/calculator/page.tsx)** - Cost calculator

## Service Data Structure

### ServicePageData Interface
```typescript
interface ServicePageData {
  hero: HeroSectionProps;        // Hero section
  problem: ProblemSectionProps;  // Problem section
  solution: SolutionSectionProps; // Solution section
  cta: CTASectionProps;          // Call-to-action
  finalCta: FinalCTAProps;       // Final CTA
  metadata: SEOMetadata;         // SEO metadata
}
```

### Service Types
```typescript
type ServiceType = 'deratization' | 'pest-control' | 'disinfection' | 'water-analysis';
```

## SEO and Metadata

### Main Metadata
- **Title**: "DEZTECHYUG - Future disinfection today | Professional sanitation service"
- **Description**: "Elite team of tech specialists. 10 years of flawless work. Complete threat elimination in 24 hours."
- **Keywords**: disinfection, pest control, deratization, water analysis, sanitation service
- **Locale**: ru_RU

### Open Graph
- Configured for social networks
- Type: website
- Locale: ru_RU

## Contact Information

### Placeholders (require updates)
- **Phone**: +7 (XXX) XXX-XX-XX (in Header)
- **Email**: info@deztehug.ru
- **Hours**: 24/7, no weekends
- **Response**: Within 2 hours

## Project Features

### Cyberpunk Design
- Neon effects and glows
- Animated particles
- Cyber grid backgrounds
- Futuristic fonts
- Bright accent colors

### Technical Features
- App Router architecture Next.js 13+
- Full TypeScript typing
- Component architecture
- Framer Motion animations
- Responsive design
- SEO optimization

### Business Logic
- Service cost calculator
- Detailed problem and solution descriptions
- Trust factors and advantages
- Call-to-action elements
- Contact information

## Development Plans

### Current Tasks
- **Footer component refinement** - final optimization and testing
- **Component testing** - verify all elements on various devices
- **Test file cleanup** - remove temporary test-*.html files after testing completion
- **Performance optimization** - analysis and loading improvements
- **TypeScript optimization** - tsconfig setup and warning fixes

### Completed Tasks
- ✅ **Complete Light Theme Adaptation for All Service Pages** - **MAJOR MILESTONE** (January 9, 2025, 5:21 PM UTC+3)
  - **All service pages fully adapted**: disinfection, pest-control, deratization, water-analysis
  - **Components updated**: [`HeroSection`](components/services/HeroSection.tsx), [`SolutionSection`](components/services/SolutionSection.tsx), [`CTASection`](components/services/CTASection.tsx), [`FinalCTASection`](components/services/FinalCTASection.tsx)
  - **Light backgrounds**: Changed from dark gradients to light ones across all pages
  - **Text optimization**: Adapted all text colors for optimal readability on light backgrounds
  - **Cyberpunk preservation**: Maintained all cyberpunk effects and corporate colors (#39FF14, #FF6B35)
  - **Browser testing**: All pages tested and confirmed working correctly
  - **Quality assurance**: Preserved design consistency while ensuring accessibility
- ✅ **Memory bank system** - complete documentation system with context tracking
- ✅ **Context.md creation** - critical memory bank file created and integrated
- ✅ **TrustFactorIcon component** - completed implementation with CSS filters for cyberpunk colors
- ✅ **WhyChooseUsIcon component** - completed implementation with dynamic SVG checking and Lucide React fallback
- ✅ **SVG icons** - created and organized all necessary icons in [`public/icons/`](public/icons/)
- ✅ **Cyberpunk Footer design** - implemented design with cyber grid background and geometric elements

### Potential Improvements
- **Add real contact data** - replace placeholders with actual data
- **CRM system integration** - connect customer management system
- **Add online chat** - instant messaging system
- **Customer review system** - feedback and rating module
- **Company blog/news** - content section of site
- **Fix metadataBase** - resolve Next.js warnings about Open Graph images

## Memory Bank Update Procedures

### Regular Documentation Updates

#### Daily (during active development):
- **Current state** - update active processes and files in development
- **Components** - record new components and changes to existing ones
- **Tasks** - update current and completed task lists
- **Timestamps** - update last change times

#### Weekly:
- **Project structure** - review changes in file structure
- **Development plans** - update short-term and medium-term plans
- **Links** - verify correctness of all file links
- **Statistics** - update metrics and indicators

#### On significant changes:
- **Architecture** - document architectural decisions and changes
- **Design system** - record changes in cyberpunk components and styles
- **Types and interfaces** - update TypeScript structures
- **Dependencies** - document package.json changes

### Update Triggers

Documentation should be updated when:
- Creating new components or pages
- Changing directory structure
- Updating design system or styles
- Adding new dependencies
- Changing service business logic
- Completing major tasks or milestones
- Discovering and fixing critical issues

### Update Process

1. **Change Analysis**
   - Identify affected documentation sections
   - Assess scope of necessary updates
   - Check related information relevance

2. **Content Updates**
   - Make changes to appropriate sections
   - Update file and component links
   - Update code examples and configurations

3. **Validation and Verification**
   - Ensure new information correctness
   - Check link functionality
   - Test code examples

4. **Finalization**
   - Update timestamps
   - Record version changes
   - Sync with brief.md if necessary

### Quality Control

#### Quality Criteria:
- **Relevance** - matches current project state
- **Completeness** - covers all important aspects and components
- **Accuracy** - no errors in links and descriptions
- **Consistency** - unified formatting style and terminology

#### Update Checklist:
- [ ] All new files and components documented
- [ ] File links correct and current
- [ ] Project structure reflects actual state
- [ ] Timestamps updated
- [ ] Task status updated
- [ ] Development plans match current priorities

---

*Last updated: January 9, 2025, 5:24 PM (UTC+3)*
*Documentation version: 1.7.0*
*Status: Active development*
*Dev server: Running*
*Responsible: Kilo Code*
