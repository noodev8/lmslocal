# Standings Page - Test Scenarios

## Summary of Key Scenarios

### Round States
1. **PENDING** - Before round locks (grouped by lives only)
2. **ACTIVE** - Mid-round, fixtures being played (grouped by lives + fixture status)
3. **COMPLETE** - All fixtures processed (grouped by lives only)

### Player Group Types
- **Champion** - Sole winner (1 active player remaining) - Gold styling with trophy icon
- **Leaders** - Top group (green highlight, thick border)
- **Middle Groups** - Neutral styling
- **Danger Zone** - Bottom active group with 0 lives (only if active players exist above them, mid-round only)
- **Eliminated** - Gray styling, minimal display

### Color Coding Rules
- **Champion**: Gold/amber background + border, trophy icon badge (exactly 1 active player)
- **Top Group**: Green background + green border (leaders, when >1 active players)
- **Danger Zone**: Red background + border (bottom active group with 0 lives, mid-round only)
- **Eliminated**: Gray background
- **All Others**: Neutral/white background

### Fixture Status (Mid-Round Only)
- **Game Played** - Fixture has result
- **Game Pending** - Pick made, fixture not played yet
- **No Pick** - No pick submitted for this round

### Edge Cases to Test
- **Sole Winner** - Exactly 1 active player remaining (shows Champion styling)
- **All players eliminated** - Only eliminated group shows
- **All players on same lives** - Single group shown as leaders
- **Only 1 player remaining** - Shows as Champion with gold trophy
- **Danger zone** - 0 lives, game not played yet (red styling, mid-round only)
- **Between rounds** - No fixture status grouping (groups by lives only)
- **Organizer viewing** - Not participating in competition
- **Player search** - Finding other players
- **Search >5 results** - Shows "refine your search" message

### Special Features
- Load More pagination (20 per page)
- Player search (max 5 results, name or email)
- View history modal
- Search → History → Back to Search flow
- Organizer access without participating
