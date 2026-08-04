# Game Dashboard Redesign Plan

## Overview

Redesign the Flutter competition home page (`competition_home_page.dart`) to match the new mockup design in `Mock-Up.jpg`. The mockup features a dark, gaming-style aesthetic with glowing effects and a dramatically different visual approach.

## Current vs Target Comparison

| Element | Current | Target (Mockup) |
|---------|---------|-----------------|
| **Theme** | Light (white/gray cards) | Dark navy with glowing effects |
| **Header** | Navy bar + white circular logo | Dark background + logo with name |
| **Players Widget** | Simple white card with number | Large glowing cyan ring with animated glow |
| **Status Cards** | Two white Material cards | Two dark cards with icons (tickets, heart) |
| **Bottom Nav** | 4 tabs (Home, Play, Standings, Profile) | 4 tabs (Home, League, Picks, Profile) |
| **Overall Style** | Standard Material Design | Gaming/esports aesthetic |

## Target File Structure

```
lib/presentation/pages/competition/
├── competition_home_page.dart          # Main orchestrator (layout + state only)
├── competition_navigation_page.dart    # Bottom nav container
└── widgets/
    ├── competition_header.dart         # (existing - keep for now)
    ├── game_header.dart                # NEW - dark themed header with logo
    ├── glowing_players_circle.dart     # NEW - centerpiece animated ring
    ├── dark_status_cards.dart          # NEW - Still In / Lives cards
    ├── pick_status_card.dart           # NEW - extracted from home page
    ├── round_results_card.dart         # NEW - extracted from home page
    ├── invite_section.dart             # NEW - extracted organizer invite UI
    └── complete_banner.dart            # NEW - extracted competition complete UI
```

**Current state of `competition_home_page.dart`:** ~1200 lines with all widgets inline

**Target state:** ~300 lines (layout, state management, widget composition)

---

## Phased Implementation

### Phase 0: Extract Existing Widgets
**Risk: Low | Impact: None (refactor only)**

Extract existing inline widgets to separate files. No visual changes - pure refactor to make the codebase manageable before redesign.

**Tasks:**
- Extract `_buildPickStatusCard` → `widgets/pick_status_card.dart`
- Extract `_buildRoundResultsCard` → `widgets/round_results_card.dart`
- Extract `_buildInviteSection` → `widgets/invite_section.dart`
- Extract `_buildCompleteBanner` → `widgets/complete_banner.dart`
- Extract `_buildUnpickedPlayersSheet` → `widgets/unpicked_players_sheet.dart`
- Update `competition_home_page.dart` to import and use extracted widgets
- Verify no visual/functional changes

**Files to create:**
- `lib/presentation/pages/competition/widgets/pick_status_card.dart`
- `lib/presentation/pages/competition/widgets/round_results_card.dart`
- `lib/presentation/pages/competition/widgets/invite_section.dart`
- `lib/presentation/pages/competition/widgets/complete_banner.dart`
- `lib/presentation/pages/competition/widgets/unpicked_players_sheet.dart`

**Files to modify:**
- `lib/presentation/pages/competition/competition_home_page.dart` - Remove extracted code, add imports

**Verification:**
- Run app and confirm all screens render identically
- Test organizer view (invite section visible)
- Test completed competition view (banner visible)
- Test pick status and round results cards

---

### Phase 1: Dark Theme Foundation
**Risk: Low | Impact: High**

Create the dark theme infrastructure without breaking existing functionality.

**Tasks:**
- Create new color constants for dark theme (deep navy background, cyan glow, etc.)
- Create a `GameThemeColors` class with dark color palette
- Keep existing widgets functional during transition

**Files to create:**
- `lib/core/theme/game_theme.dart` - Dark theme colors and styles

**Files to modify:**
- `lib/core/constants/app_constants.dart` - Add dark theme color references

---

### Phase 2: Glowing Players Circle Widget
**Risk: Medium | Impact: High**

The centerpiece widget - large circular display with glow effect.

**Tasks:**
- Create new widget: `GlowingPlayersCircle`
- Implement double-ring glow effect (outer glow + inner ring)
- Large centered number with "Players Active" text below
- Static glow for now (animation deferred to future iteration)
- Dark background container for the widget

**Files to create:**
- `lib/presentation/pages/competition/widgets/glowing_players_circle.dart`

**Files to modify:**
- `lib/presentation/pages/competition/competition_home_page.dart` - Replace current round card with new widget

---

### Phase 3: Redesigned Status Cards
**Risk: Low | Impact: Medium**

Update the "Still In" and "Lives" cards to match mockup style.

**Tasks:**
- Create new `DarkStatusCards` widget with two-card layout
- "Still In" card: ticket icon + simple status text
- "Lives" card: heart icon + count (or "Game Over" text when eliminated)
- Semi-transparent dark backgrounds with subtle glowing borders
- Replace existing `_buildPersonalStatusCards` with new widget

**Files to create:**
- `lib/presentation/pages/competition/widgets/dark_status_cards.dart`

**Files to modify:**
- `lib/presentation/pages/competition/competition_home_page.dart` - Use new DarkStatusCards widget

---

### Phase 4: Header Redesign
**Risk: Low | Impact: Medium**

Simplify the header to match mockup - logo + competition name only.

**Tasks:**
- Create new `GameHeader` widget
- Center logo with competition name below
- Integrate with dark background (no separate header container)
- Replace existing `_buildHeroHeader` with new widget

**Files to create:**
- `lib/presentation/pages/competition/widgets/game_header.dart`

**Files to modify:**
- `lib/presentation/pages/competition/competition_home_page.dart` - Use new GameHeader widget

---

### Phase 5: Bottom Navigation Update
**Risk: Low | Impact: Medium**

Update tab labels to match mockup terminology (Chat deferred to future).

**Current tabs:** Home, Play, Standings, Profile
**Target tabs:** Home, League, Picks, Profile

**Mapping:**
- Home → Home (no change)
- Play → Picks (rename)
- Standings → League (rename)
- Profile → Profile (no change)

**Tasks:**
- Rename "Play" tab to "Picks"
- Rename "Standings" tab to "League"
- Update icons if needed to match mockup style
- Chat feature deferred to future iteration

**Files to modify:**
- `lib/presentation/pages/competition/competition_navigation_page.dart`

---

## Implementation Order (Recommended)

1. **Phase 0** - Extract widgets (refactor, no visual changes - enables cleaner work)
2. **Phase 1** - Dark theme foundation (colors and styles)
3. **Phase 2** - Glowing circle (biggest visual impact)
4. **Phase 3** - Status cards (quick win)
5. **Phase 4** - Header (polish)
6. **Phase 5** - Navigation tab labels (simple rename)

## Risk Mitigation

- Each phase is independent and can be tested separately
- Existing functionality remains intact during transition
- New widgets are additive (don't delete old code until verified)
- Feature flag option: Could add a "new design" toggle during development

## Data Requirements

All data is already available - no API changes needed:

- **"28 Players Active"** - Available via `_pickStats?.totalActivePlayers`
- **"Still In"** - Available via `competition.userStatus`
- **"Lives"** - Available via `competition.livesRemaining`

## Design Decisions (Confirmed)

1. **Bottom nav tabs** - Home, League, Picks, Profile (Chat deferred to future)
2. **"Still In"** - Simple status display, no X/100 format for now
3. **Animations** - Static glow ring (animation deferred to future iteration)
4. **Scope** - UI-only changes, no backend modifications

## Estimated Effort

| Phase | Description | Effort | Dependencies |
|-------|-------------|--------|--------------|
| Phase 0 | Extract existing widgets | Medium | None |
| Phase 1 | Dark theme foundation | Small | None |
| Phase 2 | Glowing players circle | Medium | Phase 1 |
| Phase 3 | Dark status cards | Small | Phase 1 |
| Phase 4 | Game header | Small | Phase 1 |
| Phase 5 | Navigation labels | Small | None |

**Total: ~6 work sessions**

## Notes

- The mockup is the "Competition Home" tab view (within a specific competition)
- This does NOT affect the main dashboard (list of all competitions)
- Design is mobile-focused (single column, large touch targets)
- Glow effects achieved with `BoxShadow` and gradients (no special packages needed)
- All phases are UI-only - no backend or API changes required
