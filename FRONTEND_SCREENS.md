# Frontend Screens

## Design System Overview
The landing page establishes the core design system for all screens:
- **Color Palette**: Dark slate/charcoal primary (#374151, #1f2937) with light slate backgrounds and subtle gray accents
- **Typography**: Bold, large headings in dark slate with clean gray body text
- **Layout**: Clean white/light backgrounds with generous spacing, minimal borders
- **Cards**: Clean white backgrounds with subtle shadows, no heavy borders
- **Buttons**: Dark slate-800/900 primary buttons with white text, outlined secondary buttons
- **Interactive Elements**: Subtle hover states, clean transitions, professional appearance
- **Statistics/Metrics**: Large bold numbers with descriptive labels below
- **Icons**: Minimal outline style icons in slate colors

## Public/Landing Pages
- `/` - Homepage with clean hero section, stats cards, dual-column feature preview, and comprehensive sections
- `/login` - User authentication login form
- `/register` - User registration form  
- `/forgot-password` - Password reset request form

## Admin Dashboard
- `/dashboard` - Admin main dashboard with competitions list
- `/dashboard-demo` - Demo dashboard for preview/testing
- `/profile` - User profile management

## Competition Management (Admin)
- `/competition/create` - Create new competition form
- `/competition/[id]/dashboard` - Competition overview and statistics
- `/competition/[id]/manage` - Competition management (rounds, fixtures, results)
- `/competition/[id]/players` - Player management and status
- `/competition/[id]/results` - Results entry and management
- `/competition/[id]/results/confirm` - Results confirmation screen

## Player Interface
- `/play` - Competition selection/join screen
- `/play/[id]` - Active competition play screen with picks
- `/play/[id]/standings` - Competition leaderboard and player standings

## Landing Page Design Details

### Visual Hierarchy
- **Hero Section**: Large bold typography with gradient background (slate-100 to stone-100)
- **Statistics Cards**: Three-column grid with icon headers, large numbers, and mini-charts
- **Dual Preview**: Side-by-side player vs organizer experience cards
- **Content Sections**: Alternating white/slate-50 backgrounds for visual separation

### Key Components
- **Header**: Clean navigation with trophy icon logo, Sign In/Get Started buttons
- **Hero CTA**: Primary (Create Competition) and secondary (Join Competition) button pairing
- **Stats Display**: Numbers with descriptive text and simple bar chart visualizations
- **Feature Cards**: Icon-based with hover effects and consistent spacing
- **Testimonial**: User avatar with star rating system
- **Pricing Cards**: Three-tier layout with highlighted middle option
- **Footer**: Minimal branding with copyright

### Interactive Elements
- **Buttons**: Dark slate-800/900 primary with white text, clean bordered secondary
- **Cards**: Subtle hover shadows with clean, minimal styling
- **Statistics**: Large bold numbers prominently displayed with small descriptive text
- **Transitions**: Subtle, professional hover states without heavy animations

### Typography Scale
- **Headlines**: 4xl-6xl for hero, 3xl-4xl for sections, 2xl for cards
- **Body Text**: xl for descriptions, sm-base for supporting text
- **Labels**: xs-sm for metadata and fine print

This design system should be consistently applied across all 16 screens.