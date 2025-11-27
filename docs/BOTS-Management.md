# Bot Management Guide

This guide shows you how to use the permanent bot system for testing competitions.

## Overview

The system has **20 permanent bot players** that can be assigned to competitions for testing:

| Bot Name | Email |
|----------|-------|
| Bot Alice | bot_alice@lms-guest.com |
| Bot Bob | bot_bob@lms-guest.com |
| Bot Charlie | bot_charlie@lms-guest.com |
| Bot Diana | bot_diana@lms-guest.com |
| Bot Eddie | bot_eddie@lms-guest.com |
| Bot Fiona | bot_fiona@lms-guest.com |
| Bot George | bot_george@lms-guest.com |
| Bot Hannah | bot_hannah@lms-guest.com |
| Bot Ivan | bot_ivan@lms-guest.com |
| Bot Julia | bot_julia@lms-guest.com |
| Bot Kevin | bot_kevin@lms-guest.com |
| Bot Laura | bot_laura@lms-guest.com |
| Bot Mike | bot_mike@lms-guest.com |
| Bot Nina | bot_nina@lms-guest.com |
| Bot Oscar | bot_oscar@lms-guest.com |
| Bot Paula | bot_paula@lms-guest.com |
| Bot Quinn | bot_quinn@lms-guest.com |
| Bot Ryan | bot_ryan@lms-guest.com |
| Bot Sophie | bot_sophie@lms-guest.com |
| Bot Tyler | bot_tyler@lms-guest.com |

**Key Points:**
- Bots are **reusable** - the same bot can be in multiple competitions
- Bots are **obviously bots** - names start with "Bot " so players know they're not real
- Bots **cannot be removed** from a competition once assigned
- Maximum **20 bots per competition**

---

## Prerequisites

- Competition must exist and have an invite code
- Competition must NOT have started (Round 1 not locked)
- Server running on `http://localhost:3015`

---

## Step 1: Assign Bots to Competition

**Method:** POST
**URL:** `http://localhost:3015/bot-join`
**Headers:** `Content-Type: application/json`

**Body (JSON):**
```json
{
  "invite_code": "YOUR_INVITE_CODE",
  "count": 10,
  "bot_manage": "BOT_MAGIC_2025"
}
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `invite_code` | string | The competition's invite/access code or slug |
| `count` | integer | Number of bots to assign (1-20) |
| `bot_manage` | string | Always use `"BOT_MAGIC_2025"` |

### Success Response

```json
{
  "return_code": "SUCCESS",
  "message": "10 bots assigned successfully",
  "bots_assigned": 10,
  "bots_requested": 10,
  "bots_available": 10
}
```

### Response Fields

| Field | Description |
|-------|-------------|
| `bots_assigned` | How many bots were actually assigned |
| `bots_requested` | How many you requested |
| `bots_available` | Remaining bots available for this competition |

### What Happens

- Randomly selects bots from the pool of 20
- Assigns them to the competition as active players
- If you request more than available, assigns as many as possible
- Bots appear in player lists with names like "Bot Alice", "Bot Bob"

---

## Step 2: Make Bot Picks

Once the round has started and fixtures are loaded, you can make bots pick teams.

**Method:** POST
**URL:** `http://localhost:3015/bot-pick`
**Headers:** `Content-Type: application/json`

**Body (JSON):**
```json
{
  "competition_id": 123,
  "count": 10,
  "bot_manage": "BOT_MAGIC_2025"
}
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `competition_id` | integer | The competition's database ID |
| `count` | integer | Number of bots to make picks |
| `bot_manage` | string | Always use `"BOT_MAGIC_2025"` |

### Success Response

```json
{
  "return_code": "SUCCESS",
  "message": "10 of 15 bots made picks",
  "picks_made": 10,
  "total_bots": 15,
  "round_number": 2
}
```

### What Happens

- Selects `count` bots that haven't picked yet this round
- Each bot picks a random team from available fixtures
- Picks respect the same rules as regular players:
  - Cannot pick if round is locked
  - Cannot reuse previously picked teams (if no_team_twice enabled)
  - Must have fixtures available

---

## Common Scenarios

### Add All 20 Bots to a Competition

```json
{
  "invite_code": "ABC123",
  "count": 20,
  "bot_manage": "BOT_MAGIC_2025"
}
```

### Add 10 Bots (Random Selection)

```json
{
  "invite_code": "ABC123",
  "count": 10,
  "bot_manage": "BOT_MAGIC_2025"
}
```

### Make All Bots Pick

```json
{
  "competition_id": 123,
  "count": 20,
  "bot_manage": "BOT_MAGIC_2025"
}
```

### Test Partial Pick Scenario (Only 5 bots pick)

```json
{
  "competition_id": 123,
  "count": 5,
  "bot_manage": "BOT_MAGIC_2025"
}
```

---

## Finding Your Competition ID

### Method 1: From URL
When viewing the competition dashboard:
`http://localhost:3000/competition/123/dashboard`

The `123` is your competition_id.

### Method 2: From Database
```sql
SELECT id, name, invite_code FROM competition;
```

---

## Error Messages

| Error | Meaning | Solution |
|-------|---------|----------|
| `UNAUTHORIZED` | Wrong bot_manage code | Use `"BOT_MAGIC_2025"` exactly |
| `COMPETITION_NOT_FOUND` | Invalid invite code | Check your invite code is correct |
| `COMPETITION_STARTED` | Round 1 already locked | Can only add bots before first round locks |
| `NO_BOTS_AVAILABLE` | All 20 bots already in competition | Competition already has all bots |
| `ROUND_LOCKED` | Round is locked | Cannot make picks after lock time |
| `NO_FIXTURES` | No fixtures in round | Load fixtures before making picks |
| `VALIDATION_ERROR` | Invalid parameters | Check count is 1-20, all fields present |

---

## Important Notes

1. **Bot Names Are Obvious**: All bots are named "Bot [Name]" so players know they're bots
2. **Bots Are Visible**: Bots appear in standings, leaderboards, and pick statistics
3. **No Email Notifications**: Bots won't receive emails (they use `@lms-guest.com` addresses)
4. **Random Picks**: Bot picks are completely random - no strategy or logic
5. **Before Round 1**: Must add bots before competition starts
6. **Cannot Remove**: Once assigned, bots stay in the competition
7. **Shared Pool**: The same 20 bots can be in multiple competitions simultaneously

---

## Quick Reference

| Setting | Value |
|---------|-------|
| Auth Code | `BOT_MAGIC_2025` |
| Max Bots | 20 per competition |
| Bot Email Pattern | `bot_[name]@lms-guest.com` |
| Bot Name Pattern | `Bot [Name]` |

### API Endpoints

| API | URL | Purpose |
|-----|-----|---------|
| Assign Bots | `POST /bot-join` | Assign bots to competition |
| Make Picks | `POST /bot-pick` | Make picks for bots |

---

## Legacy Bots

Some older competitions may have legacy bots with:
- Email pattern: `bot_123@lms-guest.com` (numeric ID)
- Realistic names like "Emma Johnson", "Alex Smith"

The `bot-pick` API still works with these legacy bots. New competitions should use the permanent bot system.
