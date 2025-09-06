# Player Fixture Flow Documentation

## Flow Overview
When a player enters their fixture screen, the system follows a 6-step decision tree to determine what information to display and what actions are available.

## Step-by-Step Flow

### Step 1: Competition Status Check
- System checks if competition status is COMPLETE
- **COMPLETE status**: 
  - Display competition completion message with result:
    - **1 player remaining**: Show winner announcement
    - **0 players remaining**: Show draw announcement
  - Show previous round results (always available via dropdown)
  - → Exit (no further fixture interaction needed)
- **NOT COMPLETE**: Proceed to Step 2

### Step 2: Get Latest Round
- System retrieves the current/latest round for the competition
- Always proceeds to Step 3

### Step 3: Check for Rounds
- **NO rounds exist**: Display "waiting for fixtures" message → Exit
- **YES rounds exist**: Proceed to Step 4

### Step 4: Multiple Round Check
- **NO (only 1 round)**: Do not display previous round results → Step 5  
- **YES (multiple rounds)**: Display previous round results (hidden by default with dropdown option to show) → Step 5

### Step 5: Current Round Fixtures Check
- **NO fixtures in latest round**: Display "waiting for fixtures" message → Exit
- **YES fixtures exist**: Proceed to Step 6

### Step 6: Lock Time Status
- **Lock time NOT reached**: 
  - Show player's current pick (if any)
  - Player can change their pick
  - → Exit
- **Lock time reached**:
  - Show player's locked pick
  - Show selection pick count badge on each fixture (number of players who selected each team)
  - Player cannot change their pick
  - → Exit

## Key Implementation Details

- **Selection Pick Count**: Badge displayed on each fixture showing total number of players who have selected that team
- **Lock Time**: Admin-configured time stored in database `round` table, displayed on fixture screen
- **Previous Round Results**: Always available via dropdown but hidden by default when multiple rounds exist
- **Waiting Messages**: Identical message used for both "no rounds" (Step 2) and "no fixtures" (Step 4) scenarios
- **Pick Modification**: Based solely on lock time - players can change selections until lock time is reached

## Required APIs
- `get-competition-details` - Competition and current round info
- `get-player-picks` - Player's current selections
- `get-round-fixtures` - Fixtures for current round
- `get-competition-results` - Previous round results (when applicable)

## Technical Clarifications

### Selection Pick Count Details
- **What it shows**: Total number of players who have selected each specific team
- **When displayed**: Only after lock time is reached (for fairness - prevents influencing other players' choices)
- **Display location**: Small badge on each team fixture card showing the count number
- **Purpose**: Allows players to see popularity of picks after the round is locked

### Lock Time Implementation
- **Source**: Admin-configured time stored in database `round` table
- **Calculation**: Pure time-based comparison - current time vs. admin-set lock time
- **No other factors**: Lock status is determined solely by time comparison (not by all players picking or other conditions)
- **Display**: Lock time shown on fixture screen for transparency

### Previous Round Results Behavior
- **Availability**: Always accessible when multiple rounds exist in the competition
- **Default state**: Hidden by default with dropdown toggle option to show
- **Content**: Shows previous round fixtures, player's pick, pick counts, and results in the same format as the current fixture display. Cannot be modified.

### Competition Completion Display
- **Winner scenario**: Display winner announcement with player name when 1 player remains
- **Draw scenario**: Display draw message when 0 players remain active
- **Previous rounds**: Always accessible via dropdown even when competition is complete
- **No interaction**: No fixture picking or modification allowed when competition complete

### Message Consistency
- **"Waiting for fixtures"**: Identical message used in both scenarios:
  - Step 3: When no rounds exist in competition
  - Step 5: When current round has no fixtures added yet
- **Purpose**: Consistent user experience regardless of underlying cause and includes organiser name

## Summary
This flow ensures players always see appropriate information based on competition state while maintaining clear rules about when picks can be modified.