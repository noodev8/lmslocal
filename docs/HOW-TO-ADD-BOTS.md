cd /lmslocal/lmslocal-server
npm run dev
Run Postman


Compeitions: 105 - BOT League 0 Lives Knockout, 200 players
Compeitions: 106 - BOT League 1 Lives Knockout, 500 players, Also playing

# Make Bot Picks
**URL:** `http://localhost:3015/bot-pick`
{
  "competition_id": 105,
  "count": 200,
  "bot_manage": "BOT_MAGIC_2025"
}



## Step 1: Add Bots to Competition
**URL:** `http://localhost:3015/bot-join`
{
  "invite_code": "1004",
  "count": 200,
  "bot_manage": "BOT_MAGIC_2025"
}












# How to Add Bots to a Competition

This guide shows you how to populate a competition with bot players for testing using Postman or any REST client.

## Prerequisites

- Competition must exist and have an invite code
- Competition must NOT have started (no Round 1 yet)
- Server running on `http://localhost:3015`

---

## Step 1: Add Bots to Competition

**Method:** POST
**URL:** `http://localhost:3015/bot-join`
**Headers:**
- `Content-Type: application/json`

**Body (JSON):**
```json
{
  "invite_code": "YOUR_INVITE_CODE",
  "count": 50,
  "bot_manage": "BOT_MAGIC_2025"
}
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `invite_code` | string | The competition's invite/access code (e.g., "ABC123") |
| `count` | integer | Number of bots to create (min: 1, max: 200) |
| `bot_manage` | string | Always use `"BOT_MAGIC_2025"` |

### Success Response

```json
{
  "return_code": "SUCCESS",
  "message": "50 bots added successfully",
  "bots_created": 50
}
```

### What Happens

- Creates 50 bot players with realistic names like:
  - "Emma Johnson"
  - "Alex"
  - "Oliver Smith"
  - "Jordan Taylor"
- Each bot gets an email: `bot_123@lms-guest.com` (where 123 is their user ID)
- Bots are added to the competition as regular players
- Bots appear in player lists and standings

---

## Step 2: Make Bot Picks

Once the round has started and fixtures are loaded, you can make bots pick teams.

**Method:** POST
**URL:** `http://localhost:3015/bot-pick`
**Headers:**
- `Content-Type: application/json`

**Body (JSON):**
```json
{
  "competition_id": 123,
  "count": 30,
  "bot_manage": "BOT_MAGIC_2025"
}
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `competition_id` | integer | The competition's database ID (visible in URL or database) |
| `count` | integer | Number of bots to make picks |
| `bot_manage` | string | Always use `"BOT_MAGIC_2025"` |

### Success Response

```json
{
  "return_code": "SUCCESS",
  "message": "30 of 50 bots made picks",
  "picks_made": 30,
  "total_bots": 50,
  "round_number": 2
}
```

### What Happens

- Randomly selects `count` bots that haven't picked yet
- Each bot picks a completely random team from available fixtures
- Picks respect the same rules as regular players:
  - Cannot pick if round is locked
  - Cannot reuse previously picked teams
  - Must have fixtures available

---

## Common Scenarios

### Fill a Competition with 100 Bots

**POST** `http://localhost:3015/bot-join`

```json
{
  "invite_code": "ABC123",
  "count": 100,
  "bot_manage": "BOT_MAGIC_2025"
}
```

### Make All Bots Pick

If you have 100 bots and want them all to pick:

**POST** `http://localhost:3015/bot-pick`

```json
{
  "competition_id": 123,
  "count": 100,
  "bot_manage": "BOT_MAGIC_2025"
}
```

### Test Partial Pick Scenario (70% picked)

If you have 100 bots and want only 70 to pick:

**POST** `http://localhost:3015/bot-pick`

```json
{
  "competition_id": 123,
  "count": 70,
  "bot_manage": "BOT_MAGIC_2025"
}
```

---

## Finding Your Competition ID

### Method 1: From URL
When viewing the competition, the URL looks like:
`http://localhost:3000/game/123`

The `123` is your competition_id.

### Method 2: From Database
```sql
SELECT id, name, invite_code FROM competitions;
```

---

## Error Messages

| Error | Meaning | Solution |
|-------|---------|----------|
| `UNAUTHORIZED` | Wrong bot_manage code | Use `"BOT_MAGIC_2025"` exactly |
| `COMPETITION_NOT_FOUND` | Invalid invite code | Check your invite code is correct |
| `COMPETITION_STARTED` | Round 1 already started | Can only add bots before first round |
| `ROUND_LOCKED` | Round is locked | Cannot make picks after lock time |
| `NO_FIXTURES` | No fixtures in round | Load fixtures before making picks |
| `VALIDATION_ERROR` | Invalid parameters | Check count is 1-200, all fields present |

---

## Important Notes

1. **Bot Names Look Real**: Bots have names like "Emma Johnson" or "Alex" - they blend in with regular players
2. **Bots Are Visible**: Bots appear in standings, leaderboards, and pick statistics
3. **No Email Notifications**: Bots won't receive emails (they use fake `@lms-guest.com` addresses)
4. **Random Picks**: Bot picks are completely random - no strategy or logic
5. **Before Round 1**: Must add bots before competition starts
6. **Respect Lock Times**: Bots cannot pick after round locks (same as regular players)

---

## Quick Reference

**Auth Code:** `BOT_MAGIC_2025` (required for both APIs)
**Max Bots Per Call:** 200
**Bot Email Pattern:** `bot_{user_id}@lms-guest.com`

### API Endpoints

| API | URL | Purpose |
|-----|-----|---------|
| Add Bots | `POST http://localhost:3015/bot-join` | Add bots to competition |
| Make Picks | `POST http://localhost:3015/bot-pick` | Make picks for bots |
