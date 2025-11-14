# Phase 1 (Foundation) - Prerequisites & Requirements

**Goal**: Setup + Authentication (Weeks 1-2)

---

## ✅ **GATHERED - Ready to Start!**

### 1. Repository Access & Setup
- [X] **Repository location**: `C:\lmslocal` ✅
- [X] **Folder location**: Will create `C:\lmslocal\lmslocal-flutter` ✅
- [ ] **Git branch strategy**: Need confirmation - which branch to use?
  - Option 1: Create `feature/flutter-app`
  - Option 2: Work on `main`
  - Option 3: Your preferred branch name

### 2. Development Environment Details - COMPLETE ✅

#### Current API Server Information:
- [X] **Development API URL**: `http://192.168.1.136:3015` ✅
- [X] **Development Web URL**: `http://192.168.1.136:3000` ✅
- [ ] **Production API URL**: `https://api.lmslocal.co.uk` - confirm?
- [ ] **Production Web URL**: `https://www.lmslocal.co.uk` - confirm?

**Local IP Retrieved**: `192.168.1.136` (WiFi connection)

#### JWT Token Details - COMPLETE ✅
- [X] **Token expiration**: 90 days (verified from login.js:214)
- [X] **Token format**:
  ```json
  {
    "return_code": "SUCCESS",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": { "id": 123, "email": "...", "display_name": "..." },
    "session_info": { "expires_at": "...", "issued_at": "..." }
  }
  ```

### 3. Design Assets & Branding - COMPLETE ✅

- [X] **Logo file for splash screen**: FOUND! ✅
  - **Location**: `C:\lmslocal\docs\LMS-Local-Logo.png`
  - **Format**: PNG (high resolution, ready for Flutter)
  - **Design**: White "LMS LOCAL" text on navy blue background
  - **Ready to use**: Yes!

- [X] **Brand colors**: Extracted from logo ✅
  - **Primary Navy**: `#2B4E7E` (background)
  - **Primary White**: `#FFFFFF` (LMS text)
  - **Accent Light Blue**: `#6B8EBF` (LOCAL text)

- [X] **App name**: "LMS Local" ✅

### 4. ~~Firebase Setup~~ **SKIPPED FOR NOW**

- ✅ **Firebase/Crashlytics**: Postponed to Phase 2
- We'll add error tracking after the foundation is solid

---

## 🟡 **IMPORTANT - Need in First Few Days**

### 5. API Endpoint Documentation

I need to understand the existing API endpoints for authentication:

- [ ] **Login endpoint**:
  - URL: `/login`
  - Request format: `{ email: string, password: string }`
  - Response format: `{ return_code: "SUCCESS", token: string, user: {...} }`
  - Can you provide an example response?

- [ ] **Register endpoint**:
  - URL: `/register`
  - Request format: `{ email, password, display_name }`
  - Response format?

- [ ] **Forgot Password endpoint**:
  - URL: `/forgot-password`
  - Request/response format?

**OR** Can I just read these from the existing code in `lmslocal-server/routes/`?

### 6. Testing Credentials

- [ ] **Test user account**: Can you provide test credentials?
  - Email: `______`
  - Password: `______`
  - Or should I create a new test account?

---

## 🟢 **NICE TO HAVE - Can Do Later**

### 7. Splash Screen Animation

- [ ] **Preference**: Simple fade, logo zoom, or loading spinner?
- [ ] **Duration**: 1-2 seconds?
- [ ] Can decide during development

### 8. Web App Screenshots/Reference

- [ ] **Screenshots**: Can you provide screenshots of key web app screens?
  - Login page
  - Dashboard
  - Competition detail
  - Make pick screen
- [ ] **OR** Should I just run the web app locally to reference?

---

## ⚙️ **TECHNICAL SETUP - I'll Handle**

### Things I'll Do (You Don't Need to Provide):

✅ Flutter SDK installation guide (if you don't have it)
✅ Create folder structure in `lmslocal/lmslocal-flutter`
✅ Initialize Flutter project
✅ Set up BLoC architecture
✅ Install dependencies (dio, flutter_bloc, etc.)
✅ Create environment config files
✅ Build authentication screens
✅ Implement JWT token management
✅ Set up Firebase Crashlytics

---

## 📋 **Quick Checklist - What to Send Me Now**

To get started immediately, please provide:

1. **Your local IP address** (for development API/Web URLs)
   ```bash
   ipconfig  # Run this and send me the IPv4 Address
   ```

2. **Confirmation of URLs**:
   - Dev API: `http://[YOUR_IP]:3015` ✅ or different?
   - Dev Web: `http://[YOUR_IP]:3000` ✅ or different?
   - Prod API: `https://api.lmslocal.co.uk` ✅
   - Prod Web: `https://www.lmslocal.co.uk` ✅

3. **Logo for splash screen**:
   - **CRITICAL**: PNG or SVG file (512x512px or larger)
   - Where is it located in the project?
   - Can you copy to `lmslocal/docs/assets/` or tell me the path?

4. **Brand colors** (if you have them handy):
   - Primary: `#______`
   - Or just tell me to extract from `lmslocal-web/src/app/globals.css` or Tailwind config

5. **Git workflow**: Branch name for Flutter work? (e.g., `feature/flutter-app` or work on `main`)

6. ~~**Firebase**~~: **SKIPPED** - We'll add Crashlytics later in Phase 2

---

## 🚀 **Once You Provide the Above**

I can immediately:
1. Create the `lmslocal-flutter` folder
2. Initialize the Flutter project
3. Set up environment configs with your IP addresses
4. Create the folder structure
5. Build the login/register screens
6. Integrate with your existing APIs
7. Implement JWT authentication

**Estimated time to working login screen**: 2-3 hours after receiving the above info!

---

## ❓ **Questions?**

If anything on this list is unclear or you need help with any step, just let me know. I can:
- Guide you through Firebase setup
- Help you find your IP address
- Extract colors from the web app
- Create test accounts
- Anything else you need!

**Ready when you are!** 🎯
