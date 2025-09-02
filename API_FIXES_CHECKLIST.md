# API Interface Fixes - Checklist

## Phase 1: Critical Fixes (Build Breaking)

### Fix Root Interfaces in `src/lib/api.ts`
- [x] Add to Player interface: `paid: boolean`, `paid_amount?: number`, `paid_date?: string`, `joined_at: string`
- [x] Change Competition `status` from `string` to `'LOCKED' | 'UNLOCKED' | 'SETUP' | 'COMPLETE'`
- [x] Make Competition `is_organiser` required (remove `?`)
- [x] Add to Competition: `organiser_id: number`, `current_round?: number`, `player_count?: number`

### Global Find/Replace: `invite_code` → `access_code`
- [x] `src/app/dashboard/page.tsx`
- [x] `src/app/play/[id]/standings/page.tsx`
- [x] `src/app/competition/[id]/dashboard/page.tsx` *(no changes needed)*
- [x] `src/app/competition/[id]/manage/page.tsx` *(no changes needed)*
- [x] `src/app/competition/[id]/players/page.tsx` *(no changes needed)*

### Remove Local Interface Extensions
- [x] `src/app/competition/[id]/players/page.tsx` - Remove `PlayerWithPayment` interface, use main `Player`

## Current Build Error Status

**Remaining Error:** `src/app/competition/[id]/results/page.tsx:144`
- **Issue:** Type mismatch in `setCompetitionStatus(response.data)` 
- **Problem:** Component expects different structure than API response
- **Next:** Fix this specific type mismatch

## Phase 2: Remove Duplicate Local Interfaces

### Remove Local User Interfaces (import from api.ts instead)
- [ ] `src/app/competition/[id]/players/page.tsx`
- [ ] `src/app/play/[id]/page.tsx`
- [ ] `src/app/play/[id]/standings/page.tsx`

### Remove Local Competition/Round/Fixture Interfaces
- [ ] `src/app/competition/[id]/manage/page.tsx` - Remove local Competition, Team
- [ ] `src/app/competition/[id]/results/page.tsx` - Remove local Competition, Round, Fixture

## Phase 3: Type Casting Fixes ✅ COMPLETED

### Fixed Type Casting Issues
- [x] `src/app/play/[id]/page.tsx` - Fixed multiple type casting issues with proper interfaces
- [x] `src/app/play/[id]/standings/page.tsx` - Fixed hoisting issue and type casting
- [x] `src/app/play/page.tsx` - Fixed unknown types with proper casting
- [x] `src/app/register/page.tsx` - Fixed unknown error types and added User import
- [x] All ESLint `any` type errors resolved

### Build Status ✅
- [x] Run `npm run build` - **SUCCESS** 
- [x] Zero TypeScript compilation errors
- [x] Zero ESLint errors 
- [x] Clean build ready for Vercel deployment

## Quick Reference - Files Needing Work

**High Priority:**
1. `src/lib/api.ts`
2. `src/app/competition/[id]/players/page.tsx`
3. `src/app/competition/[id]/manage/page.tsx`
4. `src/app/competition/[id]/results/page.tsx`
5. `src/app/dashboard/page.tsx`

**Medium Priority:**
6. `src/app/play/[id]/standings/page.tsx`
7. `src/app/play/[id]/page.tsx`  
8. `src/app/competition/[id]/dashboard/page.tsx`