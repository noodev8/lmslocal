# Business Marketing Feature - API Endpoint Specifications

## Overview

Following LMSLocal's API conventions:
- **All routes use POST method** for consistency
- **All responses include "return_code"** field ("SUCCESS" or error type)
- **ALWAYS return HTTP 200** - Use `return_code` for success/error status
- **Single route file per function** - lowercase filenames with hyphens
- **Standard response format** with comprehensive error handling

---

## 1. MARKETING POST MANAGEMENT APIs

### 1.1 Get Marketing Posts for Competition

**File:** `lmslocal-server/routes/get-marketing-posts.js`

```javascript
/*
=======================================================================================================================================
API Route: get-marketing-posts
=======================================================================================================================================
Method: POST
Purpose: Retrieve all marketing posts for a specific competition (organizer view)
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123                    // integer, required
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "posts": [
    {
      "id": 1,                             // integer, post ID
      "competition_id": 123,               // integer, competition ID
      "post_type": "event_promotion",      // string, post type
      "title": "Derby Screening",          // string, post title
      "description": "Man City vs...",     // string, optional description
      "image_url": "https://...",          // string, optional image URL
      "cta_text": "Book Table",            // string, optional CTA text
      "cta_url": "https://...",            // string, optional CTA URL
      "start_date": "2025-01-25T15:00:00Z", // ISO string, optional
      "end_date": "2025-01-25T18:00:00Z",  // ISO string, optional
      "is_active": true,                   // boolean, active status
      "is_archived": false,                // boolean, archived status
      "display_priority": 1,               // integer, display order
      "view_count": 47,                    // integer, total views
      "click_count": 12,                   // integer, total clicks
      "created_at": "2025-01-22T10:00:00Z", // ISO string, creation time
      "updated_at": "2025-01-22T10:00:00Z", // ISO string, last update

      // Extended data (if applicable)
      "event_details": {                   // object, only for event_promotion posts
        "event_date": "2025-01-25",       // string, YYYY-MM-DD
        "event_time": "15:00",            // string, HH:MM
        "event_description": "...",       // string, optional
        "max_capacity": 50,               // integer, optional
        "booking_url": "...",             // string, optional
        "booking_requirements": "..."     // string, optional
      },

      "offer_details": {                   // object, only for special_offer posts
        "offer_conditions": "...",        // string, optional
        "offer_code": "CROWN2025",        // string, optional
        "valid_until": "2025-02-01T23:59:59Z", // ISO string, optional
        "max_redemptions": 100,           // integer, optional
        "current_redemptions": 5,         // integer, usage count
        "requires_verification": true     // boolean, staff verification needed
      }
    }
  ],
  "active_post_count": 3,                  // integer, currently active posts
  "max_posts_allowed": 4                   // integer, subscription limit
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "VALIDATION_ERROR",
  "message": "Competition ID is required"
}

{
  "return_code": "UNAUTHORIZED",
  "message": "You do not have permission to view posts for this competition"
}

{
  "return_code": "NOT_FOUND",
  "message": "Competition not found"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"UNAUTHORIZED"
"NOT_FOUND"
"SERVER_ERROR"
=======================================================================================================================================
*/
```

### 1.2 Create Marketing Post

**File:** `lmslocal-server/routes/create-marketing-post.js`

```javascript
/*
=======================================================================================================================================
API Route: create-marketing-post
=======================================================================================================================================
Method: POST
Purpose: Create a new marketing post for a competition
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123,                   // integer, required
  "post_type": "event_promotion",          // string, required: event_promotion, special_offer, announcement, custom
  "title": "Derby Screening",              // string, required, max 50 chars
  "description": "Man City vs Man United", // string, optional, max 200 chars
  "image_url": "https://...",              // string, optional
  "cta_text": "Book Table",                // string, optional, max 50 chars
  "cta_url": "https://venue.com/book",     // string, optional
  "start_date": "2025-01-25T15:00:00Z",    // ISO string, optional
  "end_date": "2025-01-25T18:00:00Z",      // ISO string, optional
  "display_priority": 1,                   // integer, optional, default 1

  // Event-specific fields (only for event_promotion)
  "event_details": {
    "event_date": "2025-01-25",           // string, optional, YYYY-MM-DD
    "event_time": "15:00",                // string, optional, HH:MM
    "event_description": "...",           // string, optional
    "max_capacity": 50,                   // integer, optional
    "booking_url": "...",                 // string, optional
    "booking_requirements": "..."         // string, optional
  },

  // Offer-specific fields (only for special_offer)
  "offer_details": {
    "offer_conditions": "Valid for...",   // string, optional, max 150 chars
    "offer_code": "CROWN2025",            // string, optional, max 20 chars
    "valid_until": "2025-02-01T23:59:59Z", // ISO string, optional
    "max_redemptions": 100,               // integer, optional
    "requires_verification": true         // boolean, optional, default false
  }
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "post_id": 456,                          // integer, newly created post ID
  "message": "Marketing post created successfully"
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "VALIDATION_ERROR",
  "message": "Title is required and must be 50 characters or less"
}

{
  "return_code": "POST_LIMIT_EXCEEDED",
  "message": "Maximum of 4 active posts allowed. Please pause or delete an existing post first."
}

{
  "return_code": "SUBSCRIPTION_REQUIRED",
  "message": "Marketing posts require a Starter subscription or higher"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"UNAUTHORIZED"
"POST_LIMIT_EXCEEDED"
"SUBSCRIPTION_REQUIRED"
"SERVER_ERROR"
=======================================================================================================================================
*/
```

### 1.3 Update Marketing Post

**File:** `lmslocal-server/routes/update-marketing-post.js`

```javascript
/*
=======================================================================================================================================
API Route: update-marketing-post
=======================================================================================================================================
Method: POST
Purpose: Update an existing marketing post
=======================================================================================================================================
Request Payload:
{
  "post_id": 456,                          // integer, required
  "title": "Derby Screening Updated",      // string, optional, max 50 chars
  "description": "Updated description",    // string, optional, max 200 chars
  "image_url": "https://...",              // string, optional
  "cta_text": "Book Now",                  // string, optional, max 50 chars
  "cta_url": "https://...",                // string, optional
  "start_date": "2025-01-25T15:00:00Z",    // ISO string, optional
  "end_date": "2025-01-25T18:00:00Z",      // ISO string, optional
  "is_active": true,                       // boolean, optional
  "display_priority": 2,                   // integer, optional

  // Extended details (same structure as create)
  "event_details": { ... },               // object, optional
  "offer_details": { ... }                // object, optional
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Marketing post updated successfully"
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "NOT_FOUND",
  "message": "Marketing post not found"
}

{
  "return_code": "UNAUTHORIZED",
  "message": "You do not have permission to edit this post"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"UNAUTHORIZED"
"NOT_FOUND"
"SERVER_ERROR"
=======================================================================================================================================
*/
```

### 1.4 Delete Marketing Post

**File:** `lmslocal-server/routes/delete-marketing-post.js`

```javascript
/*
=======================================================================================================================================
API Route: delete-marketing-post
=======================================================================================================================================
Method: POST
Purpose: Permanently delete a marketing post
=======================================================================================================================================
Request Payload:
{
  "post_id": 456                           // integer, required
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Marketing post deleted successfully"
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "NOT_FOUND",
  "message": "Marketing post not found"
}

{
  "return_code": "UNAUTHORIZED",
  "message": "You do not have permission to delete this post"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"UNAUTHORIZED"
"NOT_FOUND"
"SERVER_ERROR"
=======================================================================================================================================
*/
```

### 1.5 Toggle Post Status (Pause/Resume)

**File:** `lmslocal-server/routes/toggle-marketing-post-status.js`

```javascript
/*
=======================================================================================================================================
API Route: toggle-marketing-post-status
=======================================================================================================================================
Method: POST
Purpose: Pause or resume a marketing post (toggle is_active status)
=======================================================================================================================================
Request Payload:
{
  "post_id": 456,                          // integer, required
  "is_active": false                       // boolean, required (true = resume, false = pause)
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "new_status": "paused",                  // string, "active" or "paused"
  "message": "Marketing post paused successfully"
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "NOT_FOUND",
  "message": "Marketing post not found"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"UNAUTHORIZED"
"NOT_FOUND"
"SERVER_ERROR"
=======================================================================================================================================
*/
```

---

## 2. PLAYER-FACING APIs

### 2.1 Get Active Marketing Posts for Player Dashboard

**File:** `lmslocal-server/routes/get-competition-marketing-display.js`

```javascript
/*
=======================================================================================================================================
API Route: get-competition-marketing-display
=======================================================================================================================================
Method: POST
Purpose: Get active marketing posts for display on player competition dashboard
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123                    // integer, required
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "has_marketing_content": true,           // boolean, indicates if any posts exist
  "venue_name": "The Crown & Anchor",      // string, venue/organizer name
  "posts": [
    {
      "id": 1,                             // integer, post ID
      "post_type": "event_promotion",      // string, post type
      "title": "Derby Screening",          // string, post title
      "description": "Man City vs...",     // string, optional description
      "image_url": "https://...",          // string, optional image URL
      "cta_text": "Book Table",            // string, optional CTA text
      "cta_url": "https://...",            // string, optional CTA URL
      "display_priority": 1,               // integer, display order

      // Event-specific display data
      "event_details": {
        "event_date": "2025-01-25",       // string, YYYY-MM-DD
        "event_time": "15:00",            // string, HH:MM
        "event_description": "..."        // string, optional
      },

      // Offer-specific display data
      "offer_details": {
        "offer_conditions": "...",        // string, optional
        "offer_code": "CROWN2025",        // string, optional (for display in modal)
        "valid_until": "2025-02-01T23:59:59Z", // ISO string, optional
        "requires_verification": true     // boolean, show verification requirements
      }
    }
  ]
}

Success Response - No Marketing Content (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "has_marketing_content": false,
  "posts": []
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "NOT_FOUND",
  "message": "Competition not found"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"NOT_FOUND"
"SERVER_ERROR"
=======================================================================================================================================
*/
```

---

## 3. ANALYTICS APIs

### 3.1 Track Marketing Post View

**File:** `lmslocal-server/routes/track-marketing-view.js`

```javascript
/*
=======================================================================================================================================
API Route: track-marketing-view
=======================================================================================================================================
Method: POST
Purpose: Increment view count when marketing posts are displayed to players
=======================================================================================================================================
Request Payload:
{
  "post_id": 456,                          // integer, required
  "user_id": 789                           // integer, optional (can be null for anonymous)
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "new_view_count": 48                     // integer, updated view count
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "NOT_FOUND",
  "message": "Marketing post not found"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"NOT_FOUND"
"SERVER_ERROR"
=======================================================================================================================================
*/
```

### 3.2 Track Marketing Post Click

**File:** `lmslocal-server/routes/track-marketing-click.js`

```javascript
/*
=======================================================================================================================================
API Route: track-marketing-click
=======================================================================================================================================
Method: POST
Purpose: Increment click count when players interact with marketing post CTAs
=======================================================================================================================================
Request Payload:
{
  "post_id": 456,                          // integer, required
  "user_id": 789,                          // integer, optional
  "click_type": "cta_button"               // string, optional: cta_button, offer_code, booking_link
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "new_click_count": 13                    // integer, updated click count
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "NOT_FOUND",
  "message": "Marketing post not found"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"NOT_FOUND"
"SERVER_ERROR"
=======================================================================================================================================
*/
```

### 3.3 Get Marketing Post Analytics

**File:** `lmslocal-server/routes/get-marketing-post-analytics.js`

```javascript
/*
=======================================================================================================================================
API Route: get-marketing-post-analytics
=======================================================================================================================================
Method: POST
Purpose: Get performance analytics for a specific marketing post
=======================================================================================================================================
Request Payload:
{
  "post_id": 456                           // integer, required
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "post_title": "Derby Screening",         // string, post title for context
  "analytics": {
    "total_views": 47,                     // integer, total view count
    "total_clicks": 12,                    // integer, total click count
    "click_rate": 25.5,                    // float, percentage (clicks/views * 100)
    "created_at": "2025-01-22T10:00:00Z",  // ISO string, post creation
    "days_active": 3,                      // integer, days since creation
    "performance_rating": "above_average"  // string, compared to other posts
  },
  "insights": [                            // array, AI-generated insights
    "Post performed 42% better than average",
    "Consider similar offers for future events"
  ]
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "NOT_FOUND",
  "message": "Marketing post not found"
}

{
  "return_code": "UNAUTHORIZED",
  "message": "You do not have permission to view analytics for this post"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"UNAUTHORIZED"
"NOT_FOUND"
"SERVER_ERROR"
=======================================================================================================================================
*/
```

---

## 4. SUBSCRIPTION/ACCESS CONTROL APIs

### 4.1 Check Marketing Access

**File:** `lmslocal-server/routes/check-marketing-access.js`

```javascript
/*
=======================================================================================================================================
API Route: check-marketing-access
=======================================================================================================================================
Method: POST
Purpose: Verify if user has access to marketing features (subscription check)
=======================================================================================================================================
Request Payload:
{
  "user_id": 789                           // integer, required
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "has_access": true,                      // boolean, marketing features available
  "subscription_tier": "starter",         // string, current tier: free, starter, pro
  "features_enabled": [                   // array, available features
    "marketing_posts",
    "basic_analytics",
    "custom_branding"
  ],
  "limits": {
    "max_posts_per_competition": 4,       // integer, post limit
    "max_competitions": 999               // integer, competition limit
  }
}

Success Response - No Access (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "has_access": false,
  "subscription_tier": "free",
  "upgrade_required": "starter",
  "upgrade_benefits": [
    "Create marketing posts",
    "Promote events to players",
    "Track engagement analytics"
  ]
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "NOT_FOUND",
  "message": "User not found"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"NOT_FOUND"
"SERVER_ERROR"
=======================================================================================================================================
*/
```

---

## 5. IMPLEMENTATION NOTES

### Authentication Requirements
```javascript
// All organizer APIs require JWT verification
const { verifyToken } = require('../middleware/verifyToken');

// Player-facing APIs may be open or require minimal auth
// Analytics tracking can be anonymous
```

### Database Query Patterns
```javascript
// Get active posts for display (competition dashboard)
const activePostsQuery = `
  SELECT mp.*, me.event_date, me.event_time, mo.offer_code, mo.valid_until
  FROM marketing_posts mp
  LEFT JOIN marketing_events me ON mp.id = me.marketing_post_id
  LEFT JOIN marketing_offers mo ON mp.id = mo.marketing_post_id
  WHERE mp.competition_id = ?
    AND mp.is_active = true
    AND mp.is_archived = false
    AND (mp.start_date IS NULL OR mp.start_date <= NOW())
    AND (mp.end_date IS NULL OR mp.end_date > NOW())
  ORDER BY mp.display_priority ASC, mp.created_at DESC
  LIMIT 4
`;

// Update view count
const incrementViewQuery = `
  UPDATE marketing_posts
  SET view_count = view_count + 1
  WHERE id = ?
`;

// Update click count
const incrementClickQuery = `
  UPDATE marketing_posts
  SET click_count = click_count + 1
  WHERE id = ?
`;
```

### Error Handling Patterns
```javascript
// Consistent error response format
const sendError = (res, returnCode, message) => {
  return res.status(200).json({
    return_code: returnCode,
    message: message
  });
};

// Subscription access checking
const checkMarketingAccess = async (userId) => {
  // During beta: return true for all users
  // Post-beta: check subscription table
  return true; // Beta mode
};
```

### File Organization
```
lmslocal-server/routes/
├── create-marketing-post.js
├── update-marketing-post.js
├── delete-marketing-post.js
├── get-marketing-posts.js
├── toggle-marketing-post-status.js
├── get-competition-marketing-display.js
├── track-marketing-view.js
├── track-marketing-click.js
├── get-marketing-post-analytics.js
└── check-marketing-access.js
```

This API specification provides complete backend coverage for all marketing functionality while following LMSLocal's established patterns and conventions.