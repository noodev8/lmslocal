# Frontend Data Architecture Optimization Plan

## 🚀 IMPLEMENTATION STATUS: MAJOR SUCCESS ✅

**Rate Limit Improved:** 24 remaining → **80 remaining** (3x improvement)  
**Competition Dashboard:** 76+ API calls → **4 API calls** (95% reduction)  
**Main Dashboard:** **0 API calls** on navigation (100% reduction)

### Key Pages Optimized
- ✅ **Main Dashboard** - 100% API call reduction  
- ✅ **Competition Dashboard** - 95% API call reduction (fixed infinite loop)
- ✅ **Competition Standings** - Added caching + fixed dependency loops

### Architecture Implemented  
- ✅ **AppDataProvider Context** - Eliminates redundant API calls across pages
- ✅ **Smart Caching System** - 30s cache for real-time, 1-week for static data
- ✅ **Dependency Loop Fixes** - Resolved React infinite re-render issues

### Still To Optimize (Optional)
- Competition Results (12+ calls), Manage (6+ calls), Players (4+ calls), Player View (8+ calls)

---

## Problem Analysis

### Current Issues
- **Rate limiting hit after ~10 page navigations** (100 API calls in 15 minutes)
- **Massive API call redundancy** - same data fetched multiple times
- **Poor data flow design** - every page refetches app-level data

### Root Cause: Two-Fold Problem
1. **Wrong Cache Duration** - Ultra-static data (teams) treated as dynamic
2. **Redundant API Call Patterns** - Same data fetched multiple times per session

## Current API Call Mapping

| Page | API Calls | Key Issues |
|------|-----------|------------|
| **Dashboard** | 2 calls | `getMyCompetitions()`, `checkUserType()` |
| **Competition Dashboard** | 3 calls | `getMyCompetitions()` ←redundant, `getStatus()`, `getPickStatistics()` |
| **Competition Results** | 12+ calls | `getMyCompetitions()` ←redundant, multiple fixture/player calls |
| **Competition Manage** | 6+ calls | `getMyCompetitions()` ←redundant, team/fixture management |
| **Competition Players** | 4+ calls | `getMyCompetitions()` ←redundant, player management |
| **Play Page** | 8+ calls | No `getMyCompetitions()` but lots of player-specific calls |

### Major Redundancies Identified
- **`getMyCompetitions()`** - Called on 5+ admin pages = 5+ identical calls per session
- **`getTeams()`** - Ultra-static data (changes once/year) refetched every session
- **`getStatus()`** - Called multiple times for same competition
- **`getAllowedTeams()`** - Competition-specific but refetched unnecessarily
- **Duplicate Network Requests** - Same API called twice in quick succession (seen in Network tab)

## Two-Pronged Solution Strategy

### Strategy 1: Simple Cache Duration per Data Type ⏰

**Match cache TTL to real-world update frequency using simple in-memory cache:**

```javascript
// Simple cache utility (30 lines of code)
const createCache = (fn, ttl) => {
  let cachedResult = null;
  let cacheTime = 0;
  
  return async (...args) => {
    const now = Date.now();
    
    // Return cached result if still fresh
    if (cachedResult && (now - cacheTime) < ttl) {
      console.log('Using cached result');
      return cachedResult;
    }
    
    // Fetch fresh data
    console.log('Fetching fresh data');
    cachedResult = await fn(...args);
    cacheTime = now;
    
    return cachedResult;
  };
};

// Create cached versions with appropriate TTL
const cachedGetMyCompetitions = createCache(
  competitionApi.getMyCompetitions,
  7 * 24 * 60 * 60 * 1000  // 1 week - competitions rarely change
);

const cachedGetTeams = createCache(
  teamApi.getTeams,
  365 * 24 * 60 * 60 * 1000  // 1 year - teams change once per season
);

const cachedGetStatus = createCache(
  competitionApi.getStatus,
  30 * 1000  // 30 seconds - status can change during games
);

const cachedGetPickStatistics = createCache(
  competitionApi.getPickStatistics,
  5 * 60 * 1000  // 5 minutes - picks change hourly
);
```

### Strategy 2: Smart API Call Patterns per Page 🎯

**Only call what each page actually needs:**

#### Current Anti-Pattern
```javascript
// EVERY page does this
function CompetitionPage() {
  const competitions = await getMyCompetitions();    // ← REDUNDANT
  const teams = await getTeams();                    // ← May not need all teams
  const status = await getStatus();
  const stats = await getPickStats();
}
```

#### New Smart Pattern
```javascript
// App-level (load once)
function AppDataProvider() {
  const [competitions] = await cachedGetMyCompetitions();
  const [teams] = await cachedGetTeams();
}

// Page-level (only what's needed)
function CompetitionPage() {
  const { competitions, teams } = useAppData();           // From context - no API calls
  const allowedTeams = teams.filter(t => t.allowed);     // Filter client-side
  
  // Only fetch page-specific dynamic data
  const [status, stats] = await Promise.all([
    cachedGetStatus(id),
    cachedGetPickStatistics(id)
  ]);
}
```

## Implementation Architecture

### Simple Cache Utility
```javascript
// utils/simpleCache.js
const createCache = (fn, ttl) => {
  let cachedResult = null;
  let cacheTime = 0;
  
  return async (...args) => {
    const now = Date.now();
    
    // Return cached result if still fresh
    if (cachedResult && (now - cacheTime) < ttl) {
      console.log(`Cache HIT: ${fn.name || 'function'}`);
      return cachedResult;
    }
    
    // Fetch fresh data
    console.log(`Cache MISS: ${fn.name || 'function'} - fetching fresh`);
    cachedResult = await fn(...args);
    cacheTime = now;
    
    return cachedResult;
  };
};

// Create cached API functions
export const cachedCompetitionApi = {
  getMyCompetitions: createCache(
    competitionApi.getMyCompetitions,
    7 * 24 * 60 * 60 * 1000  // 1 week
  ),
  getStatus: createCache(
    competitionApi.getStatus,
    30 * 1000  // 30 seconds
  ),
  getPickStatistics: createCache(
    competitionApi.getPickStatistics,
    5 * 60 * 1000  // 5 minutes
  )
};

export const cachedTeamApi = {
  getTeams: createCache(
    teamApi.getTeams,
    365 * 24 * 60 * 60 * 1000  // 1 year
  )
};
```

### App-Level Data Context
```javascript
// contexts/AppDataContext.tsx
import { cachedCompetitionApi, cachedTeamApi } from '@/utils/simpleCache';

const AppDataContext = createContext();

export const AppDataProvider = ({ children }) => {
  const [competitions, setCompetitions] = useState(null);
  const [teams, setTeams] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const loadAppData = async () => {
    try {
      setLoading(true);
      
      // Load app-level data with caching
      const [competitionsData, teamsData] = await Promise.all([
        cachedCompetitionApi.getMyCompetitions(),
        cachedTeamApi.getTeams()
      ]);
      
      setCompetitions(competitionsData.competitions);
      setTeams(teamsData.teams);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadAppData();
  }, []);
  
  const refresh = () => {
    loadAppData();
  };
  
  return (
    <AppDataContext.Provider value={{ 
      competitions, 
      teams,
      loading, 
      error,
      refresh
    }}>
      {children}
    </AppDataContext.Provider>
  );
};

export const useAppData = () => {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error('useAppData must be used within AppDataProvider');
  }
  return context;
};
```

### Page-Level Smart Loading Example
```javascript
// competition/[id]/dashboard/page.tsx
import { useAppData } from '@/contexts/AppDataContext';
import { cachedCompetitionApi } from '@/utils/simpleCache';

export default function CompetitionDashboard() {
  const { competitions, teams } = useAppData(); // ✅ From context - no API calls
  const competition = competitions?.find(c => c.id.toString() === competitionId);
  
  // Only load page-specific dynamic data
  const [status, setStatus] = useState(null);
  const [statistics, setStatistics] = useState(null);
  
  useEffect(() => {
    const loadPageData = async () => {
      if (!competition) return;
      
      const [statusData, statsData] = await Promise.all([
        cachedCompetitionApi.getStatus(parseInt(competitionId)),
        cachedCompetitionApi.getPickStatistics(parseInt(competitionId))
      ]);
      
      setStatus(statusData);
      setStatistics(statsData);
    };
    
    loadPageData();
  }, [competition, competitionId]);
  
  // Rest of component remains the same...
}
```

## Expected Impact & Measurement

### Performance Gains by Strategy

**Strategy 1 (Simple Cache Duration):**
- **Teams API**: 1 call per year per user (was: multiple per session)
- **Competitions API**: 1 call per week per user (was: 5+ per session)
- **Status API**: 1 call per 30 seconds (was: multiple per page)

**Strategy 2 (Smart Call Patterns):**
- **App-level data**: Load once, use everywhere
- **Page-specific data**: Only what each page needs
- **No redundant calls**: Same data never fetched twice

### Combined Impact
- **95% reduction** in API calls for normal usage
- **Rate limiting eliminated** for typical user sessions
- **Faster page loads** - most navigation uses cached data
- **Better UX** - instant responses for cached data

### Before/After Metrics

**Before (Current):**
- Dashboard navigation: 2 API calls
- Competition pages: 3-12 API calls each
- 5 page session: ~30-50 API calls
- **Time to rate limit: 10-15 page navigations**

**After (Optimized):**
- App startup: 2 API calls (competitions + teams)
- Page navigation: 1-2 API calls (only fresh data)
- 5 page session: ~5-8 API calls
- **Time to rate limit: 50+ page navigations**

## ✅ IMPLEMENTATION COMPLETED

### ✅ Phase 1: Simple Cache Setup (COMPLETED)
- ✅ Created `src/lib/cache.ts` with comprehensive cache utility
- ✅ Created cached versions of main API functions with proper TTL
- ✅ Added cache statistics and debugging functionality

### ✅ Phase 2: App-Level Data Context (COMPLETED) 
- ✅ Created enhanced `AppDataContext` using cached APIs
- ✅ Wrapped app with `AppDataProvider` in layout.tsx
- ✅ Implemented authentication state management integration
- ✅ Added custom event handling for login/logout state changes

### ✅ Phase 3: Page Updates - PARTIALLY COMPLETED
- ✅ **Main Dashboard** (`/dashboard/page.tsx`) - **OPTIMIZED** ✨
  - Converted from direct API calls to AppDataProvider context
  - **Result: 0 API calls on navigation** (uses cached context data)
  
- ✅ **Competition Dashboard** (`/competition/[id]/dashboard/page.tsx`) - **OPTIMIZED** ✨
  - Fixed infinite dependency loop causing 76+ API calls
  - Converted `getMyCompetitions()` to use AppDataProvider context  
  - Added 30-second caching to `getStatus()` and `getPickStatistics()`
  - **Result: 4 API calls on first entry, then cached for 30 seconds**
  
- ✅ **Competition Standings** (`/play/[id]/standings/page.tsx`) - **OPTIMIZED** ✨
  - Fixed dependency loop causing infinite re-renders
  - Added 30-second caching to `getCompetitionStandings()`
  - **Result: 1 API call, then cached**

- ⏳ **Still to optimize:**
  - [ ] Competition Results page (`/competition/[id]/results/page.tsx`) - 12+ API calls
  - [ ] Competition Manage page (`/competition/[id]/manage/page.tsx`) - 6+ API calls  
  - [ ] Competition Players page (`/competition/[id]/players/page.tsx`) - 4+ API calls
  - [ ] Player Competition page (`/play/[id]/page.tsx`) - 8+ API calls

### ✅ Phase 4: Testing & Validation (COMPLETED)
- ✅ **Rate Limit Testing**: Improved from 24 remaining → 80 remaining
- ✅ **API Call Reduction**: Competition dashboard 76+ calls → 4 calls (95% reduction)
- ✅ **Navigation Performance**: Main dashboard now 0 API calls on navigation
- ✅ **Cache Effectiveness**: 30-second caching working for real-time data

## 🎯 ACTUAL RESULTS ACHIEVED

### **Performance Improvements**
- **Main Dashboard**: 2 calls → **0 calls** (100% reduction)
- **Competition Dashboard**: 76+ calls → **4 calls** (95% reduction) 
- **Competition Standings**: Multiple calls → **1 call** (cached)
- **Overall Rate Limit**: 24 remaining → **80 remaining** (significant improvement)

### **Technical Fixes Applied**
1. **Infinite Loop Elimination**: Fixed React dependency loops in useEffect hooks
2. **Context Data Sharing**: AppDataProvider eliminates redundant `getMyCompetitions()` calls
3. **Smart Caching**: 30-second cache for real-time data, 1-week cache for competitions
4. **Parallel API Calls**: Used Promise.all() to reduce execution time
5. **Authentication Integration**: Auto-reload on login/logout with custom events

### **Files Successfully Optimized**
```
✅ src/lib/cache.ts - NEW: Comprehensive cache utility
✅ src/contexts/AppDataContext.tsx - NEW: App-level data management  
✅ src/app/layout.tsx - UPDATED: Added AppDataProvider wrapper
✅ src/app/dashboard/page.tsx - UPDATED: Uses context instead of API calls
✅ src/app/competition/[id]/dashboard/page.tsx - UPDATED: Fixed loops + caching
✅ src/play/[id]/standings/page.tsx - UPDATED: Fixed dependency loop  
✅ src/lib/api.ts - UPDATED: Added caching to key APIs
✅ src/app/login/page.tsx - UPDATED: Added context refresh trigger
```

## Complete Page Inventory & Optimization Plan

### **📋 All Pages by Category**

#### **Authentication Pages** (Low Priority - 1 API call each)
- [ ] `/login` - Login page
- [ ] `/register` - User registration  
- [ ] `/forgot-password` - Password recovery

#### **Main App Pages**
- [ ] `/` - Home/landing page (minimal API usage)
- [ ] `/dashboard` - Admin dashboard - **2 API calls** (medium priority)
- [ ] `/profile` - User profile management - **1-2 API calls** (low priority)

#### **Competition Management (Admin)** - HIGH PRIORITY
- [ ] `/competition/create` - Create new competition - **2 API calls** (low priority)
- [ ] `/competition/[id]/dashboard` - Competition overview/stats - **3 API calls** ⚠️
- [ ] `/competition/[id]/manage` - Competition management - **6+ API calls** ⚠️ HIGH  
- [ ] `/competition/[id]/players` - Player management - **4 API calls** ⚠️
- [ ] `/competition/[id]/results` - Results management - **12+ API calls** ⚠️ **WORST**
- [ ] `/competition/[id]/results/confirm` - Results confirmation

#### **Player Experience** - HIGH PRIORITY  
- [ ] `/play` - Player dashboard/join competitions - **2 API calls** (medium priority)
- [ ] `/play/[id]` - Player competition view - **8+ API calls** ⚠️ **HIGH**
- [ ] `/play/[id]/standings` - Player standings view

#### **Development/Demo**
- [ ] `/dashboard-demo` - Development demo page (skip)

### **🎯 Optimization Priority Order**

#### **Phase 1: Worst Offenders (Maximum Impact)**
1. **`/competition/[id]/results`** - 12+ API calls ← Start here
2. **`/play/[id]`** - 8+ API calls  
3. **`/competition/[id]/manage`** - 6+ API calls

#### **Phase 2: Medium Impact**  
4. **`/competition/[id]/players`** - 4 API calls
5. **`/competition/[id]/dashboard`** - 3 API calls  
6. **`/dashboard`** - 2 API calls
7. **`/play`** - 2 API calls

#### **Phase 3: Low Impact (Optional)**
8. All other pages - 1-2 API calls each

### **Expected API Call Reduction by Phase**

**Current State:**
- Worst pages: 12+ calls each
- Total for 5-page session: ~30-50 API calls
- Rate limit hit: ~10 page navigations

**After Phase 1:**
- Worst pages: ~2-3 calls each  
- Total for 5-page session: ~10-15 API calls
- Rate limit hit: ~25 page navigations

**After Phase 2:**  
- All major pages: ~1-2 calls each
- Total for 5-page session: ~5-8 API calls  
- Rate limit hit: 50+ page navigations

## Files to Modify

### New Files
- `src/utils/simpleCache.js` - Simple cache utility (30 lines)
- `src/contexts/AppDataContext.tsx` - App data context with caching

### Updated Files (In Priority Order)

#### **Phase 1 Files:**
- [ ] `src/app/layout.tsx` - Wrap with AppDataProvider (do first)
- [ ] `src/app/competition/[id]/results/page.tsx` - **PRIORITY 1** - Remove `getMyCompetitions()` redundancy
- [ ] `src/app/play/[id]/page.tsx` - **PRIORITY 2** - Optimize player API calls  
- [ ] `src/app/competition/[id]/manage/page.tsx` - **PRIORITY 3** - Remove `getMyCompetitions()` redundancy

#### **Phase 2 Files:**
- [ ] `src/app/competition/[id]/players/page.tsx` - Use context + cached APIs
- [ ] `src/app/competition/[id]/dashboard/page.tsx` - Use context + cached APIs
- [ ] `src/app/dashboard/page.tsx` - Use context instead of direct API call
- [ ] `src/app/play/page.tsx` - Optimize if needed

#### **Phase 3 Files (Optional):**
- [ ] All remaining pages as time permits

## Testing Strategy

### Cache Testing
- [ ] Verify teams cached for 1 year (check console logs)
- [ ] Verify competitions cached for 1 week (check console logs)
- [ ] Test cache expiration works correctly

### API Call Reduction Testing
- [ ] Baseline: Count current calls per navigation session
- [ ] After implementation: Count optimized calls per session
- [ ] Verify 95% reduction achieved

### User-Friendly Refresh UX

**Modern apps include manual refresh controls for user confidence:**

```javascript
// Enhanced AppDataContext with refresh tracking
export const AppDataProvider = ({ children }) => {
  const [competitions, setCompetitions] = useState(null);
  const [teams, setTeams] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  const loadAppData = async () => {
    try {
      setLoading(true);
      const [competitionsData, teamsData] = await Promise.all([
        cachedCompetitionApi.getMyCompetitions(),
        cachedTeamApi.getTeams()
      ]);
      
      setCompetitions(competitionsData.competitions);
      setTeams(teamsData.teams);
      setLastUpdated(Date.now());
    } catch (err) {
      console.error('Failed to load app data:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const refreshData = () => {
    // Clear caches by reloading (simple approach)
    window.location.reload();
  };
  
  return (
    <AppDataContext.Provider value={{ 
      competitions, 
      teams,
      loading, 
      lastUpdated,
      refreshData
    }}>
      {children}
    </AppDataContext.Provider>
  );
};
```

**Dashboard Header with Refresh Controls:**
```javascript
// competition/[id]/dashboard/page.tsx
const CompetitionDashboard = () => {
  const { competitions, lastUpdated, refreshData } = useAppData();
  
  const formatTimeAgo = (timestamp) => {
    const minutes = Math.floor((Date.now() - timestamp) / (1000 * 60));
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };
  
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-semibold text-slate-900">
              Competition Dashboard
            </h1>
            
            {/* Modern Refresh Controls */}
            <div className="flex items-center gap-3">
              {lastUpdated && (
                <span className="text-sm text-slate-500">
                  Updated {formatTimeAgo(lastUpdated)}
                </span>
              )}
              <button 
                onClick={refreshData}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                title="Refresh data"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>
      
      {/* Rest of dashboard */}
    </div>
  );
};
```

**Page-Level Refresh for Dynamic Data:**
```javascript
// For pages with frequently changing data
const CompetitionResults = () => {
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  
  const refreshPageData = async () => {
    // Force refresh of cached page-specific data
    await Promise.all([
      cachedCompetitionApi.getStatus(competitionId, true), // Force fresh
      cachedCompetitionApi.getPickStatistics(competitionId, true)
    ]);
    setLastRefresh(Date.now());
  };
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-medium">Live Results</h2>
        <button 
          onClick={refreshPageData}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          🔄 Refresh Results
        </button>
      </div>
      {/* Results content */}
    </div>
  );
};
```

### Why This UX Works
- **User Control**: Users can refresh when they want fresh data
- **Transparency**: Shows when data was last updated  
- **Performance**: Avoids constant background polling
- **Reliability**: Always works, regardless of cache state
- **Modern Pattern**: Used by Twitter, Gmail, Slack, GitHub

## Error Handling & Server Resilience

### **Current Problem: Server Overload**
**Root Issue**: High API call volume (30-50 per session) causes server to stop responding entirely, resulting in network failures rather than graceful rate limiting.

**User Experience**: "Network Error" or complete page crashes instead of user-friendly messages.

### **Enhanced Error Handling**

**Updated Axios Interceptor with Network Failure Detection:**
```javascript
// src/lib/api.ts - Enhanced response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle authentication errors
    if (error.response?.status === 401) {
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('user');
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth-expired'));
      }
    }
    
    // Handle proper rate limiting (HTTP 429)
    if (error.response?.status === 429) {
      const message = error.response?.data?.message || 'Too many requests. Please wait a moment and try again.';
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('rate-limit-exceeded', {
          detail: { message }
        }));
      }
      
      console.warn('Rate limit exceeded:', message);
    }
    
    // Handle server crashes/network failures (the real problem)
    if (!error.response || 
        error.code === 'ERR_NETWORK' || 
        error.code === 'ERR_CONNECTION_REFUSED' ||
        error.message === 'Network Error') {
      
      console.error('Server appears to be down or overwhelmed:', error.code);
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('server-unavailable', {
          detail: { 
            message: 'Server is temporarily unavailable. Please try refreshing the page in a moment.',
            error: error.code,
            canRetry: true
          }
        }));
      }
    }
    
    return Promise.reject(error);
  }
);
```

**Global Error Handler Component:**
```javascript
// components/GlobalErrorHandler.tsx
import { useEffect } from 'react';

const GlobalErrorHandler = () => {
  useEffect(() => {
    const handleRateLimit = (event) => {
      // Show rate limit toast
      toast.warning(event.detail.message, {
        duration: 5000,
        id: 'rate-limit' // Prevent spam
      });
    };
    
    const handleServerUnavailable = (event) => {
      // Show server down notification with retry option
      toast.error(event.detail.message, {
        duration: 10000,
        id: 'server-down',
        action: {
          label: 'Refresh Page',
          onClick: () => window.location.reload()
        }
      });
    };
    
    window.addEventListener('rate-limit-exceeded', handleRateLimit);
    window.addEventListener('server-unavailable', handleServerUnavailable);
    
    return () => {
      window.removeEventListener('rate-limit-exceeded', handleRateLimit);
      window.removeEventListener('server-unavailable', handleServerUnavailable);
    };
  }, []);
  
  return null; // This is just an event listener component
};

export default GlobalErrorHandler;
```

**Add to App Layout:**
```javascript
// src/app/layout.tsx
import GlobalErrorHandler from '@/components/GlobalErrorHandler';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AppDataProvider>
          <GlobalErrorHandler />
          {children}
        </AppDataProvider>
      </body>
    </html>
  );
}
```

### **User-Friendly Error Messages**

**Instead of:**
- "Network Error"
- "Failed to fetch"
- Page crashes silently

**Users now see:**
- **Rate Limit**: "Too many requests. Please wait a moment and try again."
- **Server Down**: "Server is temporarily unavailable. Please try refreshing the page in a moment." [Refresh Page button]

### **Why This Approach Works**

1. **Prevents App Crashes**: Graceful error handling keeps app functional
2. **User Understanding**: Clear messages explain what's happening
3. **Recovery Options**: Provides users with actionable solutions (refresh)
4. **Developer Insight**: Console logging helps debug the real issues
5. **Covers All Scenarios**: Handles both proper rate limiting AND server overload

### **Expected Behavior After Implementation**

**Before (Current):**
- 30-50 API calls per session
- Server stops responding under load
- Users see "Network Error" or crashes
- No recovery path except random refresh

**After (Enhanced Error Handling):**
- Same API call volume initially  
- Server still gets overwhelmed
- **BUT**: Users see friendly messages with clear recovery steps
- No more mysterious crashes

**After (Caching + Error Handling):**
- 5-8 API calls per session
- Server load reduced by 80%+
- Rare server overload situations handled gracefully
- Professional user experience even during problems

---

**Status**: Ready for implementation  
**Estimated Time**: 5 hours total  
**Expected Impact**: 95% reduction in API calls, rate limiting eliminated  
**Approach**: Simple 30-line cache utility + smart data architecture

---

## 📋 CURRENT CACHE CONFIGURATION STATUS

### ✅ **IMPLEMENTED & OPTIMIZED APIs**

| API Endpoint | Current TTL | Status | Notes |
|-------------|-------------|--------|-------|
| **`getMyCompetitions`** | **1 day** | ✅ Optimized | Competitions list rarely changes |
| **`getStatus`** | **5 minutes** | ✅ Fixed | Was 30s, increased to prevent rate limits |
| **`getPlayers`** | **2 minutes** | ✅ Optimized | Player data during admin work |
| **`getPickStatistics`** | **3 minutes** | ✅ Fixed | Pick stats, less critical for admins |
| **`getCompetitionStandings`** | **5 minutes** | ✅ Optimized | Standings after results |

### ⚠️ **RECOMMENDED ADDITIONAL CACHING** 

*Please review and adjust these TTL suggestions:*

| API Endpoint | Suggested TTL | Current | Reasoning |
|-------------|---------------|---------|-----------|
| **`getTeams`** | **1 day** | No cache | Team rosters change seasonally, but admin may edit |
| **`getTeamLists`** | **1 hour** | No cache | Team lists for competitions, may be edited |
| **`checkUserType`** | **1 day** | No cache | User permissions rarely change mid-session |
| **`getPlayerDashboard`** | **5 minutes?** | No cache | Player view, different usage pattern |

### 🔴 **CORRECTLY NON-CACHED APIs**

These should remain non-cached:
- `removePlayer` - Action API
- `joinCompetitionByCode` - Action API  
- `updatePaymentStatus` - Action API
- All fixture/round creation APIs - Action APIs

### 📝 **CACHE TTL ADJUSTMENT GUIDELINES**

**Consider these factors when setting TTL:**
- **How often do YOU edit this data?** (teams, competitions)
- **How time-sensitive is it for admins?** (less than players)
- **Rate limit vs. data freshness trade-off**

**Recommended TTL Ranges:**
- **Static reference data**: 1-4 hours (teams, lists)
- **User permissions**: 1-24 hours (auth, user type)
- **Competition metadata**: 1 week (competition details)
- **Live game data**: 2-5 minutes (stats, standings)

Please adjust the suggested TTLs and let me know your preferences!