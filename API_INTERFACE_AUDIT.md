# API Interface Mismatch Audit Report

Generated on: 2025-09-01

## Executive Summary

This audit identifies critical mismatches between API interface definitions in `src/lib/api.ts` and their actual usage across the codebase. These mismatches are causing TypeScript compilation errors and potential runtime crashes.

## Critical Issues (Must Fix - Build Breaking)

### 1. Property Name Conflict: `access_code` vs `invite_code`

**Problem:** Interface defines `access_code` but components use `invite_code`

**Interface Definition:** `access_code?: string`
**Components Use:** `invite_code`

**Affected Files:**
- `src/app/dashboard/page.tsx` (lines ~383, 390, 395)
- `src/app/play/[id]/standings/page.tsx` (lines ~233, 245) 
- `src/app/competition/[id]/dashboard/page.tsx` (line ~361)
- `src/app/competition/[id]/manage/page.tsx` (lines ~583, 587, 590)
- `src/app/competition/[id]/players/page.tsx` (multiple locations)

**Impact:** Runtime undefined property access, broken invite code display
**Severity:** 🔴 CRITICAL

### 2. Missing Player Properties

**Problem:** Components expect payment/join fields not in Player interface

**Interface Missing:**
```typescript
paid: boolean;
paid_amount?: number;
paid_date?: string;
joined_at: string;
```

**Affected Files:**
- `src/app/competition/[id]/players/page.tsx` (payment filtering, display logic)

**Impact:** Payment system completely broken
**Severity:** 🔴 CRITICAL

### 3. Competition Status Type Issues

**Problem:** Generic `string` type instead of specific enum values

**Interface Definition:** `status?: string`
**Components Expect:** `'LOCKED' | 'UNLOCKED' | 'SETUP' | 'COMPLETE'`

**Affected Files:**
- `src/app/dashboard/page.tsx` (status comparisons)
- `src/app/play/page.tsx` (competition filtering)
- `src/app/competition/[id]/dashboard/page.tsx` (status display)

**Impact:** Status checks fail, UI shows wrong states
**Severity:** 🔴 CRITICAL

## Moderate Issues (Type Safety Problems)

### 4. Missing Competition Properties

**Interface Missing:**
```typescript
is_organiser: boolean; // Currently optional, should be required
organiser_id: number;
current_round?: number;
player_count?: number;
```

**Affected Files:**
- Multiple dashboard and management components
- Authorization checks rely on `is_organiser`

**Impact:** Poor type safety, potential authorization issues
**Severity:** 🟡 MODERATE

### 5. Duplicate Local Interface Definitions

**Problem:** Components define own interfaces instead of importing from api.ts

**Files with Local Duplicates:**
- `src/app/competition/[id]/players/page.tsx` - User, PlayerWithPayment
- `src/app/play/[id]/page.tsx` - User
- `src/app/play/[id]/standings/page.tsx` - User  
- `src/app/competition/[id]/manage/page.tsx` - Competition, Team
- `src/app/competition/[id]/results/page.tsx` - Competition, Round, Fixture

**Impact:** Inconsistent types, maintenance nightmare
**Severity:** 🟡 MODERATE

## Fix Priority & Action Plan

### Phase 1: Critical Fixes (Required for Build)

#### Task 1.1: Fix API Interfaces in `src/lib/api.ts`
```typescript
// Add to Player interface:
paid: boolean;
paid_amount?: number;
paid_date?: string;
joined_at: string;

// Fix Competition interface:
status: 'LOCKED' | 'UNLOCKED' | 'SETUP' | 'COMPLETE';
is_organiser: boolean; // Remove optional
organiser_id: number;
current_round?: number;
player_count?: number;
access_code?: string; // Confirm this is correct vs invite_code
```

#### Task 1.2: Global Property Rename
**Decision Required:** Use `access_code` or `invite_code`?
- Recommendation: Keep `access_code` (matches backend)
- Find/Replace `invite_code` → `access_code` in all files

**Files to Update:**
- src/app/dashboard/page.tsx
- src/app/play/[id]/standings/page.tsx
- src/app/competition/[id]/dashboard/page.tsx
- src/app/competition/[id]/manage/page.tsx
- src/app/competition/[id]/players/page.tsx

#### Task 1.3: Remove PlayerWithPayment Extension
- File: `src/app/competition/[id]/players/page.tsx`
- Remove local `PlayerWithPayment` interface
- Update component to use main `Player` interface

### Phase 2: Type Safety Improvements

#### Task 2.1: Remove Duplicate Interface Definitions
For each file listed in "Duplicate Local Interface Definitions":
1. Remove local interface
2. Import from `src/lib/api.ts`
3. Update component typing

#### Task 2.2: Add Missing Properties
Update components that expect additional properties not in interfaces

### Phase 3: Code Quality

#### Task 3.1: Add JSDoc Documentation
#### Task 3.2: Create Type Guards
#### Task 3.3: Add Runtime Validation

## Testing Strategy

### After Each Phase:
1. Run `npm run build` to check TypeScript compilation
2. Test affected features manually
3. Check browser console for runtime errors

### Critical Test Areas:
- Competition invite code display/copy
- Player payment status filtering
- Competition status checks and UI updates
- Authorization (is_organiser checks)

## Why This Happened

1. **Backend/Frontend Drift:** API responses evolved but interfaces weren't updated
2. **Local Workarounds:** Developers created local interfaces instead of fixing root cause
3. **Missing Type Validation:** No runtime checks to catch interface mismatches

## Prevention for Future

1. **API Contract Testing:** Validate runtime data matches interfaces
2. **Centralized Types:** Strict rule - no local interface duplicates
3. **CI/CD Integration:** TypeScript strict mode in build pipeline
4. **Documentation:** Clear API documentation with examples

## Estimated Timeline

- **Phase 1 (Critical):** 2-3 hours
- **Phase 2 (Type Safety):** 1-2 hours  
- **Phase 3 (Quality):** 1 hour
- **Total:** 4-6 hours

## Files Summary

**Total Files Affected:** 15+
**Critical Files:** 7
**Moderate Files:** 8

**Most Important First:**
1. `src/lib/api.ts` (biggest impact)
2. `src/app/competition/[id]/players/page.tsx` (payment system)
3. Global find/replace for property names