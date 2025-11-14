# Vercel Deployment Guide - LMSLocal

## Quick Reference

**✅ ALWAYS deploy from ROOT directory:**
```powershell
cd C:\lmslocal
vercel --prod
```

**❌ DO NOT deploy from lmslocal-web:**
```powershell
# DON'T DO THIS:
cd C:\lmslocal\lmslocal-web
vercel --prod
```

---

## Why Deploy from Root?

Your Vercel project is configured with:
- **Root Directory:** `lmslocal-web` (set in Vercel dashboard)
- **Git Connection:** Connected to main branch of noodev8/lmslocal

When you deploy from the root directory, Vercel CLI:
1. Uploads from `/lmslocal` root
2. Applies the "Root Directory: lmslocal-web" setting automatically
3. Only builds/deploys the Next.js app from `lmslocal-web` subdirectory

---

## Deployment Methods

### Method 1: Git Push (Auto-Deploy) - DISABLED

Auto-deployment is currently **turned off** in Vercel settings.

If you enable it:
```powershell
git add .
git commit -m "Your commit message"
git push
# Vercel auto-deploys from GitHub
```

### Method 2: Manual CLI Deploy (Current Method)

```powershell
# 1. Make sure you're in the root directory
cd C:\lmslocal

# 2. Check you have latest changes committed
git status

# 3. Deploy to production
vercel --prod

# Expected output: "Uploaded 121KB" (approximately)
```

---

## Safety Features in Place

### .vercelignore
Prevents accidentally uploading unwanted files:
```
lmslocal-flutter/
lmslocal-server/
docs/
*.mp4
*.mov
*.avi
server-check.txt
```

### .gitignore
Prevents committing build artifacts and dependencies:
- `node_modules/`
- `.next/`
- `build/`
- `.dart_tool/`
- Flutter/Android/iOS build artifacts

---

## Pre-Deployment Checklist

Before running `vercel --prod`:

1. ✅ **Test locally:** Run `npm run build` in `lmslocal-web` to check for errors
2. ✅ **Check git status:** Make sure all changes are committed
3. ✅ **Verify location:** Confirm you're in `/lmslocal` root
4. ✅ **Expected upload size:** Should be ~100-200KB (source code only)

---

## Troubleshooting

### "File size limit exceeded (100 MB)"

**Problem:** Deploying from wrong directory or large files not ignored

**Solution:**
```powershell
# Make sure you're in ROOT, not lmslocal-web
cd C:\lmslocal
vercel --prod
```

Check `.vercelignore` is present in root directory.

---

### "Build failed" or TypeScript errors

**Problem:** TypeScript compilation errors in web app

**Solution:**
```powershell
# Test build locally first
cd C:\lmslocal\lmslocal-web
npm run build

# Fix any errors shown
# Then deploy from root
cd C:\lmslocal
vercel --prod
```

---

### Build succeeds but changes not visible

**Problem:** Browser cache or CDN cache

**Solution:**
1. Hard refresh: `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
2. Check Vercel dashboard for deployment status
3. Verify deployment shows latest commit hash

---

## Deployment Flow Diagram

```
┌─────────────────────────────────────────┐
│  Developer makes changes locally        │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  cd C:\lmslocal (ROOT directory)        │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  vercel --prod                          │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  Vercel uploads ~121KB of source code   │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  Vercel uses "Root Directory" setting   │
│  to build from lmslocal-web/            │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  Production deployment live at          │
│  https://www.lmslocal.co.uk             │
└─────────────────────────────────────────┘
```

---

## Vercel Dashboard Links

- **Project:** https://vercel.com/noodev8-8382s-projects/lmslocal
- **Settings:** Project Settings → Build and Deployment → Root Directory: `lmslocal-web`
- **Deployments:** View all production and preview deployments

---

## Rollback Procedure

If a deployment breaks production:

1. Go to Vercel dashboard
2. Click on "Deployments" tab
3. Find the last working deployment
4. Click "..." menu → "Promote to Production"
5. Instant rollback complete (no rebuild needed)

---

## Tips

- **Test builds locally** before deploying with `npm run build`
- **Keep auto-deploy OFF** for manual control over production
- **Use preview deployments** with `vercel` (no `--prod` flag) to test changes
- **Source size ~121KB** is normal - much more means something's wrong
- **Build time ~2-5 minutes** is typical for Next.js production builds

---

## Contact

If you see unexpected behavior or need to modify Vercel settings, check:
1. This deployment guide
2. `.vercelignore` in root
3. Vercel dashboard Root Directory setting

---

**Last Updated:** 2025-11-14
**Vercel Project:** lmslocal
**Production URL:** https://www.lmslocal.co.uk
