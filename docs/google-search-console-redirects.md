# Google Search Console Redirect Issue - Status & Investigation

**Date**: 2025-11-18
**Status**: Waiting for Google re-crawl validation

## The Issue

Google Search Console reported "Page with redirect" validation failures for:
- `http://lmslocal.co.uk/`
- `https://lmslocal.co.uk/help/support`
- `http://www.lmslocal.co.uk/`

**Error Type**: Validation failed (started 11/11/2025, failed 15/11/2025)

## Investigation Results

### Current Domain Configuration (Verified via curl)

**Canonical Domain**: `www.lmslocal.co.uk` (with www)

Redirect behavior:
- `https://www.lmslocal.co.uk/*` → **HTTP 200** (primary domain)
- `https://lmslocal.co.uk/*` → **HTTP 307** redirect to `https://www.lmslocal.co.uk/*`
- HTTPS enforcement → Already enabled by Vercel (HSTS header present)

### Where Redirects Are Configured

**Vercel Domain Settings** (DNS/edge level) - NOT in code
- Redirects happen at Vercel's edge network before Next.js code runs
- Configuration managed in Vercel Dashboard → Project Settings → Domains
- Non-www automatically redirects to www version

### What We Tried (FAILED)

**Commit**: `07230ad` - Added redirect rules to `vercel.json`
**Result**: ERR_TOO_MANY_REDIRECTS - infinite redirect loop on production
**Reverted**: `05b60af` - Emergency revert

**Why it failed**:
- Attempted to redirect www → non-www in vercel.json
- Vercel DNS was already redirecting non-www → www
- Created infinite loop: www → non-www → www → non-www...

## Current State

✅ **Production Working**: Site fully operational at `https://www.lmslocal.co.uk`
✅ **Redirects Working**: All variations properly redirect to canonical www domain
✅ **Google Validation Requested**: Waiting for re-crawl (can take days/weeks)

### Code Configuration

- **vercel.json**: Clean config, no redirect rules (domain redirects handled by Vercel automatically)
- **next.config.js**: No redirect configuration
- **middleware**: No middleware file exists
- **HSTS Header**: Automatically added by Vercel

## Next Steps If Issues Persist

If Google Search Console still shows redirect failures after re-crawl:

1. **Check Vercel Domain Settings**:
   - Verify both domains are added to project
   - Confirm www.lmslocal.co.uk is set as primary
   - Check redirect settings in Vercel dashboard

2. **Test All URL Variations**:
   ```bash
   curl -I http://lmslocal.co.uk
   curl -I http://www.lmslocal.co.uk
   curl -I https://lmslocal.co.uk
   curl -I https://www.lmslocal.co.uk
   ```
   All should redirect to `https://www.lmslocal.co.uk`

3. **Review Google Search Console Details**:
   - Click into specific failed URLs
   - Check exact error messages
   - Verify Google is seeing the 307/301 redirects properly

4. **If Changing Canonical Domain**:
   - If deciding to use non-www (lmslocal.co.uk) instead
   - Must change in Vercel Dashboard → Domains section
   - Set non-www as primary domain
   - Vercel will automatically reverse the redirect direction

## Important Notes

- **DO NOT** add redirect rules to `vercel.json` - causes redirect loops
- **DO NOT** create middleware for domain redirects - Vercel handles automatically
- Domain canonicalization is a DNS/Vercel setting, not a code issue
- Google re-crawl can take days or weeks - be patient

## Reference

- Google Search Console validation started: 11/11/2025
- Validation failed: 15/11/2025
- Requested re-validation: 18/11/2025
- Production incident: 18/11/2025 (resolved within minutes)
