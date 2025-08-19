# LMSLocal Component Library Specification

This document defines the reusable UI components for LMSLocal, built on Material UI (MUI) with Material Design 3 principles.

## Design System Foundation

### Color Tokens
```typescript
// Primary palette - LMS brand colors
primary: {
  50: '#e3f2fd',   // Light backgrounds
  100: '#bbdefb',  // Disabled states
  500: '#2196f3',  // Main brand color
  700: '#1976d2',  // Hover states
  900: '#0d47a1'   // Text on light backgrounds
}

// Semantic colors
success: '#4caf50',    // Wins, confirmations
error: '#f44336',      // Losses, eliminations  
warning: '#ff9800',    // Pending states, deadlines
info: '#2196f3'        // Information, neutral states
```

### Typography Scale
```typescript
// Material Design 3 typography
displayLarge: '57px',    // Hero headlines
displayMedium: '45px',   // Page titles
headlineLarge: '32px',   // Section headers
headlineMedium: '28px',  // Component titles
titleLarge: '22px',      // Card titles
titleMedium: '16px',     // List items
bodyLarge: '16px',       // Body text
bodyMedium: '14px',      // Secondary text
labelLarge: '14px',      // Buttons
labelMedium: '12px'      // Form labels
```

### Spacing System
```typescript
// 8px base unit system
spacing: {
  0: '0px',
  1: '4px',     // xs - icon padding
  2: '8px',     // sm - component padding
  3: '12px',    // md - form spacing
  4: '16px',    // lg - card padding
  6: '24px',    // xl - section spacing
  8: '32px',    // 2xl - page margins
  12: '48px',   // 3xl - hero spacing
  16: '64px'    // 4xl - major sections
}
```

## Core Navigation Components

### AppHeader
**Purpose**: Global navigation and user context
```tsx
interface AppHeaderProps {
  user: User | null;
  currentPage: 'dashboard' | 'competitions' | 'players' | 'settings';
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

// MUI Components: AppBar, Toolbar, Typography, IconButton, Menu
// Responsive: Mobile hamburger menu, desktop full nav
// States: Authenticated vs anonymous variants
```

### SideNavigation  
**Purpose**: Secondary navigation for complex flows
```tsx
interface SideNavigationProps {
  items: NavItem[];
  currentItem: string;
  collapsed?: boolean;
  onItemClick: (itemId: string) => void;
}

// MUI Components: Drawer, List, ListItem, ListItemIcon, ListItemText
// Responsive: Auto-collapse on mobile
// States: Active item highlighting
```

### Breadcrumbs
**Purpose**: Show navigation hierarchy in deep flows
```tsx
interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  onNavigate: (path: string) => void;
}

// MUI Components: Breadcrumbs, Link, Typography
// Responsive: Truncate on mobile
```

## Data Display Components

### CompetitionCard
**Purpose**: Display competition info in dashboards/lists
```tsx
interface CompetitionCardProps {
  competition: Competition;
  variant: 'player' | 'organizer' | 'pub-owner';
  actions?: CompetitionAction[];
  showStats?: boolean;
  onClick?: () => void;
}

// MUI Components: Card, CardContent, CardActions, Chip, LinearProgress
// Variants: Different layouts per user persona
// States: active, completed, paused, setup
```

### PlayerCard
**Purpose**: Display player info with status
```tsx
interface PlayerCardProps {
  player: Player;
  status: 'active' | 'eliminated' | 'pending';
  livesRemaining?: number;
  currentPick?: string;
  actions?: PlayerAction[];
}

// MUI Components: Card, Avatar, Typography, Chip, Badge
// States: Visual status indicators, managed player styling
```

### PickCard  
**Purpose**: Display team pick with validation
```tsx
interface PickCardProps {
  team: Team;
  fixture: Fixture;
  selected: boolean;
  disabled: boolean;
  alreadyPicked?: boolean;
  onClick: () => void;
}

// MUI Components: Card, CardActionArea, Typography, Chip
// States: selectable, disabled, already-picked, confirmed
// Visual: Team logos, fixture details, validation states
```

### StandingsTable
**Purpose**: Competition leaderboard display
```tsx
interface StandingsTableProps {
  players: PlayerStanding[];
  currentRound: number;
  sortBy: 'position' | 'lives' | 'name';
  onSortChange: (field: string) => void;
}

// MUI Components: Table, TableHead, TableBody, TableRow, TableCell
// Features: Sortable columns, responsive design, elimination highlighting
```

## Form Components

### LoginForm
**Purpose**: Magic link email authentication
```tsx
interface LoginFormProps {
  onSubmit: (email: string) => void;
  loading: boolean;
  error?: string;
  variant: 'player' | 'organizer' | 'pub-owner';
}

// MUI Components: TextField, Button, Alert, CircularProgress
// Validation: Email format, required field
// States: Loading, error, success
```

### CompetitionWizard
**Purpose**: Multi-step competition creation
```tsx
interface CompetitionWizardProps {
  initialData?: Partial<Competition>;
  onComplete: (competition: Competition) => void;
  onCancel: () => void;
}

// MUI Components: Stepper, StepLabel, Card, TextField, Select, Button
// Steps: Basic info, Rules, Players, Review
// Validation: Per-step validation, final review
```

### QuickPickForm
**Purpose**: Fast team selection interface  
```tsx
interface QuickPickFormProps {
  fixtures: Fixture[];
  excludedTeams: string[];
  onPick: (teamId: string) => void;
  deadline: Date;
}

// MUI Components: RadioGroup, FormControlLabel, Button, Alert
// Features: Team filtering, deadline warning, confirmation dialog
```

### BulkPlayerImport
**Purpose**: CSV/manual player addition
```tsx
interface BulkPlayerImportProps {
  onImport: (players: PlayerImport[]) => void;
  existingPlayers?: Player[];
  maxPlayers?: number;
}

// MUI Components: FileUpload, TextField, DataGrid, Button
// Features: CSV parsing, duplicate detection, validation feedback
```

## Feedback Components  

### StatusChip
**Purpose**: Competition/player status indicators
```tsx
interface StatusChipProps {
  status: CompetitionStatus | PlayerStatus;
  variant: 'outlined' | 'filled';
  size: 'small' | 'medium';
}

// MUI Components: Chip
// Color mapping: active=success, eliminated=error, pending=warning
```

### ProgressIndicator
**Purpose**: Round progress and deadlines
```tsx
interface ProgressIndicatorProps {
  current: number;
  total: number;
  deadline?: Date;
  status: 'pending' | 'locked' | 'completed';
}

// MUI Components: LinearProgress, Typography, Chip
// Features: Time remaining, visual progress, status color coding
```

### NotificationToast
**Purpose**: System feedback and alerts
```tsx
interface NotificationToastProps {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  action?: NotificationAction;
  duration?: number;
}

// MUI Components: Snackbar, Alert, IconButton
// Auto-dismiss: Configurable timing, manual dismiss option
```

### ConfirmationDialog
**Purpose**: Critical action confirmation
```tsx
interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  severity?: 'warning' | 'error';
  onConfirm: () => void;
  onCancel: () => void;
}

// MUI Components: Dialog, DialogTitle, DialogContent, DialogActions, Button
// Use cases: Player elimination, competition deletion, pick changes
```

## Business Components

### ROICalculator
**Purpose**: Pub owner revenue projection
```tsx
interface ROICalculatorProps {
  onCalculate: (inputs: ROIInputs) => void;
  results?: ROIResults;
  variant: 'knowing' | 'unknown';
}

// MUI Components: Slider, TextField, Card, Typography, Button
// Features: Real-time calculation, visual charts, comparison tables
```

### RevenueTracker
**Purpose**: Entry fee and earnings display
```tsx
interface RevenueTrackerProps {
  competitions: Competition[];
  timeframe: 'week' | 'month' | 'year';
  onExport?: () => void;
}

// MUI Components: Card, Typography, Chart components, Button
// Features: Period selection, export functionality, trend visualization
```

### AuditLogViewer
**Purpose**: Admin action history
```tsx
interface AuditLogViewerProps {
  logs: AuditLog[];
  onFilter: (filters: AuditFilters) => void;
  onExport?: () => void;
}

// MUI Components: DataGrid, TextField, DatePicker, Select
// Features: Filtering, sorting, export, detailed view
```

## Layout Components

### PageContainer
**Purpose**: Consistent page structure
```tsx
interface PageContainerProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  children: React.ReactNode;
}

// MUI Components: Container, Typography, Stack
// Responsive: Proper spacing, mobile optimization
```

### DashboardGrid
**Purpose**: Responsive card layouts
```tsx
interface DashboardGridProps {
  items: React.ReactNode[];
  columns?: { xs: number; sm: number; md: number; lg: number };
  spacing?: number;
}

// MUI Components: Grid, Stack
// Responsive: Auto-adjusting grid based on content
```

### SplitView
**Purpose**: Master-detail layouts
```tsx
interface SplitViewProps {
  sidebar: React.ReactNode;
  main: React.ReactNode;
  sidebarWidth?: number;
  collapsible?: boolean;
}

// MUI Components: Box, Drawer (for mobile)
// Responsive: Drawer on mobile, split on desktop
```

## Responsive Breakpoints

```typescript
breakpoints: {
  xs: 0,      // Mobile portrait
  sm: 600,    // Mobile landscape
  md: 900,    // Tablet
  lg: 1200,   // Desktop
  xl: 1536    // Large desktop
}

// Component behavior per breakpoint
// xs-sm: Stack vertically, full width, simplified nav
// md+: Grid layouts, sidebar nav, detailed views
```

## Implementation Priorities

### Phase 1 (MVP) - Core Components
1. AppHeader, LoginForm, CompetitionCard
2. PickCard, StatusChip, ConfirmationDialog
3. PageContainer, DashboardGrid

### Phase 2 - Competition Management  
1. CompetitionWizard, PlayerCard, StandingsTable
2. QuickPickForm, BulkPlayerImport
3. ProgressIndicator, NotificationToast

### Phase 3 - Business Features
1. ROICalculator, RevenueTracker
2. AuditLogViewer, SplitView
3. Advanced responsive patterns

## Design System Integration

All components will use:
- Material UI base components
- Consistent theme tokens (colors, typography, spacing)
- Tailwind CSS for utility styling
- React TypeScript for type safety
- Responsive-first mobile design

---

*This component library specification serves as the implementation guide for all UI development in LMSLocal.*