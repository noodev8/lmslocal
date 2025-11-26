# Mobile Notifications Plan

Plan for push notifications in the LMS Flutter mobile app.

## Overview

Simple, non-intrusive notifications to keep players engaged without spamming. Focus on essential game events only.

## Core Principles

- **One notification max** - Never send multiple notifications at once. One notification brings them to the app.
- **Smart delivery** - Only notify when action is needed or relevant
- **Casual tone** - Friendly, not formal
- **System opt-out** - Users control via iOS/Android settings. No in-app toggles needed initially.

---

## Notification Types

### 1. New Round Open

| Aspect | Detail |
|--------|--------|
| **Purpose** | Alert player that a new round is available for picks |
| **Trigger** | Admin creates/opens a new round |
| **Condition** | Player is active (not eliminated) in that competition |
| **Message** | "A new round is open - time to make your pick!" |
| **Deep link** | Opens app (competition pick screen) |
| **Priority** | High - this is the primary engagement driver |

### 2. Pick Reminder

| Aspect | Detail |
|--------|--------|
| **Purpose** | Remind player to make a pick before lock time |
| **Trigger** | 24 hours before round lock time |
| **Conditions** | Player has NOT made a pick AND player is still active (not eliminated) AND round is not locked |
| **Message** | "Don't forget to make your pick before it locks!" |
| **Deep link** | Opens app (competition pick screen) |
| **Priority** | High - prevents accidental life loss |

### 3. Round Results

| Aspect | Detail |
|--------|--------|
| **Purpose** | Inform player that results are in |
| **Trigger** | Results are processed for the round |
| **Condition** | Player was active during that round (made a pick or was still in competition) |
| **Message** | "Results are in - see how you did!" |
| **Deep link** | Opens app (results/standings screen) |
| **Priority** | Medium - informational |

---

## Multiple Competition Handling

Players may be in multiple competitions simultaneously.

**Rule:** Send ONE notification only, even if multiple competitions have updates.

| Scenario | Behaviour |
|----------|-----------|
| New round in 2 competitions | Send one "new round" notification |
| Results in Competition A, player eliminated there but active in B | Only consider Competition B |
| Pick reminder needed for 3 competitions | Send one reminder notification |

The notification brings them to the app. They discover all updates once inside.

---

## Notification Priority Order

When multiple notification types are pending, send the highest priority:

1. **Pick Reminder** (time-sensitive, prevents life loss)
2. **New Round Open** (action needed)
3. **Round Results** (informational)

---

## What We Are NOT Doing (For Now)

- Per-competition mute (exists for email, not needed for push yet)
- In-app notification preferences
- Organizer notifications (dashboard is sufficient)
- Elimination-specific notifications (covered by Round Results)
- Competition invite notifications

---

## Technical Implementation

### Push Notification Service

**Firebase Cloud Messaging (FCM)** - Industry standard, free, supports iOS and Android.

Setup required:
- Create Firebase project
- Add iOS/Android config files to Flutter app
- Store FCM server key in backend `.env`

---

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        TRIGGERS                                 │
├─────────────────────────────────────────────────────────────────┤
│ • Round created        → API adds 'new_round' + 'pick_reminder' │
│ • Results processed    → API adds 'results' entry               │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│               mobile_notification_queue table                   │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│              Server Cron (every 5 mins)                         │
│              POST /process-mobile-notifications                 │
├─────────────────────────────────────────────────────────────────┤
│ API handles all logic:                                          │
│ • Query pending queue entries                                   │
│ • For reminders: check lock_time - 24hrs <= NOW()               │
│ • Check player conditions (has pick? still active?)             │
│ • Apply one-notification rule                                   │
│ • Send via FCM                                                  │
│ • Update queue status                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

### Database: mobile_notification_queue Table

```sql
CREATE TABLE mobile_notification_queue (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    type VARCHAR(20) NOT NULL,          -- 'new_round' | 'pick_reminder' | 'results'
    competition_id INTEGER NOT NULL,
    round_id INTEGER NOT NULL,
    round_number INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'sent' | 'skipped'
    created_at TIMESTAMP DEFAULT NOW(),
    sent_at TIMESTAMP
);

CREATE INDEX idx_mobile_notification_queue_pending
ON mobile_notification_queue(status, created_at)
WHERE status = 'pending';
```

---

### Database: device_tokens Table

```sql
CREATE TABLE device_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    fcm_token TEXT NOT NULL,
    platform VARCHAR(10),               -- 'ios' | 'android'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, fcm_token)
);
```

---

### Backend API Routes

| Route | Purpose |
|-------|---------|
| `POST /register-device-token` | Flutter app sends FCM token on login/startup |
| `POST /process-mobile-notifications` | Cron hits this to process queue and send via FCM |

---

### Queue Entry Timing

| Type | When queued | When sent |
|------|-------------|-----------|
| **new_round** | Round created | Next cron run (immediate) |
| **pick_reminder** | Round created | When `lock_time - 24hrs <= NOW()` |
| **results** | Results processed | Next cron run (immediate) |

**Note:** Reminder timing calculated at send time (not queue time) so lock time changes are automatically respected.

---

### Processing Logic (process-mobile-notifications API)

```
1. Get all pending 'new_round' and 'results' entries
2. Get all pending 'pick_reminder' entries WHERE round.lock_time - 24hrs <= NOW()
3. For each entry, check conditions:
   - Player still active in competition?
   - For reminders: player hasn't picked yet?
   - For results: player was active that round?
4. Group by user_id
5. Apply one-notification rule (highest priority wins)
6. Send one FCM notification per user
7. Mark entries as 'sent' or 'skipped'
```

---

### Flutter Integration

1. **Package:** `firebase_messaging`
2. **On app startup:**
   - Request notification permission
   - Get FCM token
   - Send token to backend via `/register-device-token`
3. **On notification tap:**
   - Open app (deep linking to relevant screen - future enhancement)

---

### Server Cron Setup

```bash
# Run every 5 minutes
*/5 * * * * curl -X POST https://your-api-domain/process-mobile-notifications -H "Authorization: Bearer BOT_TOKEN"
```

---

## What We Are NOT Doing (For Now)

- Per-competition mute (exists for email, not needed for push yet)
- In-app notification preferences
- Organizer notifications (dashboard is sufficient)
- Elimination-specific notifications (covered by Round Results)
- Competition invite notifications
- Deep linking to specific screens (app just opens)

---

## Firebase Setup (User Action Required)

Before implementation can begin, you need to set up Firebase:

### 1. Create Firebase Project
- Go to [Firebase Console](https://console.firebase.google.com/)
- Create new project (or use existing if you have one)
- Name it something like "LMS Local"

### 2. Add Android App
- In Firebase Console → Project Settings → Add app → Android
- **Package name:** `uk.co.lmslocal.lmslocal_flutter`
- Download `google-services.json`
- Place it in `lmslocal-flutter/android/app/google-services.json`

### 3. Add iOS App
- In Firebase Console → Project Settings → Add app → iOS
- **Bundle ID:** `uk.co.lmslocal.lmslocalflutter`
- Download `GoogleService-Info.plist`
- Place it in `lmslocal-flutter/ios/Runner/GoogleService-Info.plist`

### 4. Get Service Account for Backend
- Firebase Console → Project Settings → **Service accounts** tab
- Click **Generate new private key**
- Download the JSON file (e.g., `lms-local-xxxxx-firebase-adminsdk-xxxxx.json`)
- Save to `lmslocal-server/` folder
- Already added to `.gitignore` - never commit this file

### 5. Enable Cloud Messaging
- Firebase Console → Build → Cloud Messaging
- Ensure it's enabled for your project

### 6. Git Ignore Considerations

**Backend .env** - Already gitignored. Add `FCM_SERVER_KEY` there (never commit server keys).
- I need to add this to the .env file on the VPS server

---

## Implementation Checklist

### Phase 1: Firebase & Database Setup
- [x] Create Firebase project ("LMS Local")
- [x] Add Android app config (`google-services.json`) - committed
- [x] Add iOS app config (`GoogleService-Info.plist`) - committed
- [x] Get Firebase service account JSON (saved to `lmslocal-server/`, gitignored)
- [x] Upload APNs key to Firebase (Production)
- [x] Create `mobile_notification_queue` table in database
- [x] Create `device_tokens` table in database

### Phase 2: Backend Implementation
- [x] Create `/register-device-token` API route
- [x] Create `/process-mobile-notifications` API route
- [x] Add FCM service to send notifications (`services/fcmService.js`)
- [x] Install `firebase-admin` npm package on server
- [x] Modify round creation to queue 'new_round' + 'pick_reminder' entries
- [x] Modify results processing to queue 'results' entries
- [ ] Set up server cron job

### Phase 3: Flutter Implementation
- [x] Add `firebase_core` and `firebase_messaging` packages
- [x] Initialize Firebase in app
- [x] Create NotificationService (`lib/core/services/notification_service.dart`)
- [x] Request notification permissions on login/app start
- [x] Get and send FCM token to backend
- [x] Handle token refresh (automatic via listener)
- [x] Handle notification tap (opens app - default behavior)

### Phase 4: Testing
- [ ] Test token registration (new install)
- [ ] Test token registration (existing user update)
- [ ] Test 'new_round' notification
- [ ] Test 'reminder' notification (24hr before lock)
- [ ] Test 'results' notification
- [ ] Test one-notification rule with multiple competitions
- [ ] Test skipping eliminated players

---

## Status

- [x] Requirements defined
- [x] Technical design
- [x] Firebase setup (completed 2025-11-26)
- [ ] Backend implementation ← **NEXT**
- [ ] Flutter implementation
- [ ] Testing

## Resume Point

When resuming, start with:
1. ~~Create database tables~~ ✓ Done
2. Create `/register-device-token` API route
3. Create `/process-mobile-notifications` API route
4. Then Flutter integration
