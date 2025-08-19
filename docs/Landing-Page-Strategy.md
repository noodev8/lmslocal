# Landing Page Strategy - Persona-Based Routing

This document defines the landing page architecture that serves all four user personas with intelligent routing and progressive disclosure.

## Landing Page Architecture

### Single Page, Multiple Personas Approach
Rather than separate landing pages, we use one adaptive page that reveals relevant content based on user behavior and explicit persona selection.

```
┌─────────────────────────────────────────────────────┐
│ HERO SECTION - Universal Appeal                     │
├─────────────────────────────────────────────────────┤
│ PERSONA SELECTOR - Smart Routing                    │  
├─────────────────────────────────────────────────────┤
│ ADAPTIVE CONTENT - Context-Aware                    │
├─────────────────────────────────────────────────────┤
│ SOCIAL PROOF - Trust Building                       │
├─────────────────────────────────────────────────────┤
│ CTA SECTION - Persona-Specific Actions              │
└─────────────────────────────────────────────────────┘
```

## Hero Section (Universal)

### Primary Headline
```
Last Man Standing Competitions
Made Simple
```

### Sub-headline  
```
Run football elimination games for your pub, workplace, or social group. 
No spreadsheets, no calculations, no disputes.
```

### Quick Value Props (Icons + Text)
```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ ⚡ Easy Setup│ 📱 Any Device│ 🏆 Fair Play│ 💷 Revenue +│
│ 5min to     │ Web-based   │ Auto        │ Happy       │
│ launch      │ works       │ elimination │ customers   │
│             │ everywhere  │ & results   │             │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

### Hero CTA Buttons
```
┌─────────────────┬─────────────────┐
│ Start Free      │ Join Competition│  
│ Competition →   │ (Have Code?) →  │
└─────────────────┴─────────────────┘
```

## Persona Selector Section

### Smart Detection + Manual Override
```
┌─────────────────────────────────────────────────────┐
│ "I want to..."                                       │
│                                                     │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐     │
│ │ 🎯 Organize │ │ 🏃 Play     │ │ 🏪 For My   │     │
│ │ Competition │ │ in Game     │ │ Business    │     │
│ │             │ │             │ │             │     │
│ │ [Select] →  │ │ [Select] →  │ │ [Select] →  │     │
│ └─────────────┘ └─────────────┘ └─────────────┘     │
│                                                     │
│ "Already running LMS manually?" [Yes] [No]          │
└─────────────────────────────────────────────────────┘
```

## Adaptive Content Sections

### For Admin/Organizer
```
┌─────────────────────────────────────────────────────┐
│ "Perfect for Competition Organizers"                │
│                                                     │
│ ✓ Create competition in under 5 minutes            │
│ ✓ Invite players via email or shareable codes      │
│ ✓ Automatic pick tracking and elimination           │
│ ✓ Real-time leaderboards and standings             │
│ ✓ Handle disputes with complete audit trail         │
│                                                     │
│ [Start Free Competition] [See Demo →]               │
└─────────────────────────────────────────────────────┘
```

### For Player  
```
┌─────────────────────────────────────────────────────┐
│ "Join the Fun"                                      │
│                                                     │
│ ✓ Make your weekly picks in seconds                │
│ ✓ Track your progress against friends               │
│ ✓ Get notifications before deadlines               │
│ ✓ View live standings and results                  │
│ ✓ Play in multiple competitions at once            │
│                                                     │
│ [Enter Invite Code] [How It Works →]                │
└─────────────────────────────────────────────────────┘
```

### For Knowing Pub Owner
```
┌─────────────────────────────────────────────────────┐
│ "Upgrade Your LMS Game"                             │
│                                                     │
│ ❌ Stop: Spreadsheet errors and disputes            │
│ ❌ Stop: Hours spent on manual calculations         │
│ ❌ Stop: Chasing players for picks                  │
│                                                     │
│ ✅ Start: Professional, automated system            │
│ ✅ Start: More players, higher engagement           │
│ ✅ Start: Better customer experience                │
│                                                     │
│ [Calculate ROI] [Start Free Trial →]                │
└─────────────────────────────────────────────────────┘
```

### For Unknown Pub Owner
```
┌─────────────────────────────────────────────────────┐
│ "New Revenue Stream for Your Pub"                   │
│                                                     │
│ 🎯 Attract more customers during football season    │
│ 💷 Generate entry fee revenue + increased spending  │
│ 🏆 Build community and regular customer loyalty     │
│ 📈 Easy to run - we handle all the complexity       │
│                                                     │
│ "What is Last Man Standing?" [Learn More →]         │
│ [Calculate Potential Revenue →]                     │
└─────────────────────────────────────────────────────┘
```

## Social Proof Section

### Testimonials Grid
```
┌─────────────────────────────────────────────────────┐
│ ⭐⭐⭐⭐⭐ "Saved me hours every week"                  │
│ - Sarah, The Red Lion Pub                          │
│                                                     │
│ ⭐⭐⭐⭐⭐ "Players love the professional feel"         │
│ - Mike, Office LMS Organizer                       │
│                                                     │
│ ⭐⭐⭐⭐⭐ "Tripled our player participation"           │
│ - Tom, Crown & Anchor                              │
└─────────────────────────────────────────────────────┘
```

### Statistics
```
┌─────────────┬─────────────┬─────────────┐
│ 500+        │ 15,000+     │ 98%         │
│ Competitions│ Players     │ Satisfaction│
│ Running     │ Active      │ Rate        │
└─────────────┴─────────────┴─────────────┘
```

## Persona-Specific CTA Sections

### Admin/Organizer CTA
```
┌─────────────────────────────────────────────────────┐
│ Ready to Start Your Competition?                    │
│                                                     │
│ ┌─────────────────┬─────────────────────────────────┐ │
│ │ Free Forever    │ [Create Competition]           │ │
│ │ ≤ 5 Players     │                                │ │
│ └─────────────────┴─────────────────────────────────┘ │
│                                                     │
│ ┌─────────────────┬─────────────────────────────────┐ │
│ │ £39/Competition │ [Start Free Trial]             │ │
│ │ Unlimited       │                                │ │
│ │ Players         │                                │ │
│ └─────────────────┴─────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Player CTA
```
┌─────────────────────────────────────────────────────┐
│ Ready to Join a Competition?                        │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Got an invite code?                             │ │
│ │ [___________] [Join Now]                        │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ Or [Browse Public Competitions →]                   │
└─────────────────────────────────────────────────────┘
```

### Pub Owner CTA
```
┌─────────────────────────────────────────────────────┐
│ Calculate Your Revenue Potential                    │
│                                                     │
│ [Interactive ROI Calculator]                        │
│                                                     │
│ Then: [Start Free Trial] [Book Demo Call]           │
└─────────────────────────────────────────────────────┘
```

## Responsive Layout Strategy

### Mobile (xs-sm)
```
┌─────────────────┐
│ Hero (stacked)  │
├─────────────────┤
│ Persona Cards   │
│ (vertical)      │
├─────────────────┤
│ Adaptive Content│
│ (single column) │
├─────────────────┤
│ Social Proof    │
│ (carousel)      │
├─────────────────┤
│ CTA Section     │
└─────────────────┘
```

### Desktop (md+)
```
┌─────────────────────────────────┐
│ Hero (2-column layout)          │
├─────────────────────────────────┤
│ Persona Cards (3-column grid)   │
├─────────────────────────────────┤
│ Adaptive Content (featured)     │
├─────────────────────────────────┤
│ Social Proof (3-column grid)    │
├─────────────────────────────────┤
│ CTA Section (comparison table)  │
└─────────────────────────────────┘
```

## Component Implementation

### LandingHero Component
```tsx
interface LandingHeroProps {
  onPersonaSelect: (persona: PersonaType) => void;
  onCTAClick: (action: 'create' | 'join') => void;
}
// MUI: Container, Typography, Button, Grid, Card
```

### PersonaSelector Component  
```tsx
interface PersonaSelectorProps {
  selectedPersona?: PersonaType;
  onSelect: (persona: PersonaType) => void;
}
// MUI: Card, CardActionArea, Typography, Icon
```

### AdaptiveContent Component
```tsx
interface AdaptiveContentProps {
  persona: PersonaType;
  onCTAClick: (action: string) => void;
}
// MUI: Container, Typography, List, Button
// Conditional rendering based on persona
```

### ROICalculator Component (Embedded)
```tsx
interface ROICalculatorProps {
  variant: 'knowing' | 'unknown';
  onComplete: (results: ROIResults) => void;
}
// MUI: Slider, TextField, Card, Chart components
```

## Smart Routing Logic

### URL-Based Persona Detection
```typescript
// /organizer → Auto-select Admin/Organizer
// /player → Auto-select Player  
// /business → Auto-select Pub Owner (knowing)
// /pubs → Auto-select Pub Owner (unknown)
// / → Show persona selector
```

### Query Parameter Support
```typescript
// /?invite=ABC123 → Auto-select Player, pre-fill code
// /?trial=pub → Auto-select Pub Owner, trial focus
// /?demo=true → Add demo mode to any persona
```

### Conversion Tracking
```typescript
// Track persona selection
// Track CTA click rates per persona
// Track time-to-action by persona
// A/B test different value propositions
```

## Implementation Priority

### Phase 1: Core Landing Page
1. Hero section with universal appeal
2. Basic persona selector (3 cards)
3. Simple adaptive content switching
4. Primary CTAs per persona

### Phase 2: Enhanced Features
1. Smart URL routing and query params
2. ROI calculator integration
3. Social proof components
4. Advanced responsive layouts

### Phase 3: Optimization
1. A/B testing framework
2. Advanced conversion tracking  
3. Progressive disclosure patterns
4. Performance optimization

---

*This landing page strategy balances universal appeal with persona-specific conversion optimization, ensuring all user types find relevant value propositions and clear next steps.*