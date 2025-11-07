# LMSLocal Onboarding Plan v1.0

**Status:** Active (Free Beta Testing)
**Current Customer:** Inglenook Cafe
**Offer:** Free setup (normally £149)
**Goal:** Learn and refine process before paid rollout

---

## Core Philosophy

**"Done For You" Approach:**
- Build competition FIRST with smart defaults - before contacting pub
- Never ask questions that cause overwhelm or decision paralysis
- Launch with sensible settings even if pub provides zero information
- Customers review finished product rather than making decisions from scratch
- Run the entire competition - pub can be hands-off or hands-on (their choice)

**Psychology Flip:**
❌ Don't ask: "What do you want? When? How much? What settings?"
✅ Instead say: "Your competition is READY with our best-practice settings - here's what we've set up"

**Key Learning (Inglenook):**
Asking too many questions = frozen contact. Build first, present finished product, unstick them with simplicity.

---

## Smart Defaults (No Waiting Required)

**Competition Settings:**
- **Name:** "[Pub Name] Last Man Standing"
- **Entry Fee:** £10 (suggested - pub can tell players different)
- **Prize Structure:** 50% Winner / 50% Charity (suggested - pub decides)
- **Start Date:** 2 weeks from setup
- **Access Code:** Auto-generated memorable code (e.g., "PUBNAME2025")
- **Competition Type:** Premier League fixtures

**Key Principle:** If pub provides ZERO input, we launch with these settings ✅

---

## Execution Checklist (Linear Process)

### STEP 1: Competition Build FIRST (30 mins - Day 0)

**BUILD BEFORE CONTACTING - Critical for "Done For You" approach**

**Manual Setup in LMSLocal:**
1. Create competition: "[Pub Name] Last Man Standing"
2. Set access code: Memorable format (e.g., "INGLENOOK2025")
3. Upload logo if provided (or leave blank for text-only layout)
4. Set entry fee: £10
5. Set prize structure: "50% Winner / 50% Charity"
6. Configure: Standard Premier League fixtures, 1 life per player
7. Set round 1 lock time: Saturday 2 weeks from today, 3pm
8. Generate join link
9. Note competition ID and access code
10. Create WhatsApp group: "[Pub Name] Last Man Standing"
11. Pin welcome message in WhatsApp group (see template below)

**Required Information:**
- Pub name (minimum)
- Everything else uses smart defaults

**Competition Assets Ready:**
- ✅ Competition URL (join link)
- ✅ Access Code
- ✅ Leaflet URL (automatically generated at `/leaflet/[ID]`)
- ✅ WhatsApp group with shareable link
- ✅ Admin login credentials (if needed)

**WhatsApp Group Pinned Message:**
```
Welcome to [Pub Name] Last Man Standing! ⚽

Join the competition:
🔗 [JOIN_URL]
🔑 Code: [ACCESS_CODE]

📅 Starts: [START_DATE]
💰 Entry: £10 (pay at [Pub Name])
🏆 Prize: 50% Winner / 50% Charity

Rules: Pick one team each week. Win = stay alive. Can't repeat teams.

I'll send reminders before each round locks.

Questions? Ask here anytime! Good luck 🍀

- [Your Name], LMSLocal
```

---

### STEP 2: Initial Contact - "Done For You" Message (5 mins - Day 0)

**Communication Method:** WhatsApp (preferred) or Email

**IMPORTANT:** If contact seems overwhelmed or frozen from previous questions, use the "Unstick Message" template instead.

**Standard "Done For You" WhatsApp/Email:**

```
Hi [Name],

Your Last Man Standing competition is READY! 🎯

We've built it with our best-practice settings that work brilliantly for pubs.

YOUR COMPETITION:
🔗 Join Link: [JOIN_URL]
🔑 Access Code: [ACCESS_CODE]
📅 Start Date: [START_DATE]
💰 Entry Fee: £10
🏆 Prize: 50% Winner / 50% Charity

Here's the best bit - you can be as hands-on or hands-off as you like:

✅ I'LL HANDLE:
• Weekly pick reminders to players
• Results updates
• Running the WhatsApp group
• All the admin and technical stuff
• Player questions and support

✅ YOU JUST NEED TO:
• Put up leaflets when they arrive (I'm posting 5 to you)
• Share the join link with your customers
• Collect entry fees your way (cash, bank transfer, whatever)

That's it! I'll run the whole thing.

Want to be more involved? Great! Want me to handle it all? Also great!

Your promotional leaflet: [LEAFLET_URL]

Sound good? 👍
```

**"Unstick Message" (If Contact Is Frozen/Overwhelmed):**

```
Hi [Name],

Forget all those questions I asked - I've gone ahead and set everything up with our standard settings! 🎯

YOUR COMPETITION IS READY:
🔗 Join Link: [JOIN_URL]
🔑 Access Code: [ACCESS_CODE]
📅 Start Date: [START_DATE]
💰 Entry Fee: £10
🏆 Prize: 50% Winner / 50% Charity

Here's the best bit - you can be as hands-on or hands-off as you like:

✅ I'LL HANDLE:
• Weekly pick reminders to players
• Results updates
• Running the WhatsApp group
• All the admin and technical stuff
• Player questions and support

✅ YOU JUST NEED TO:
• Put up leaflets when they arrive (I'm posting 5 to you)
• Share the join link with your customers
• Collect entry fees your way (cash, bank transfer, whatever)

That's literally it. I'll run the whole thing.

Want to be more involved? Great! Want me to handle it all? Also great!

Your promotional leaflet is ready here: [LEAFLET_URL]

Sound good? 👍
```

**Action:**
- Send immediately after building competition
- Don't send anything else until they respond
- Wait for positive response before proceeding

---

### STEP 3: Leaflet Generation (Instant - Day 0)

**✅ IMPLEMENTED - Automated Leaflet System**

The leaflet is now fully automated using your Next.js app. Each competition automatically gets a printable leaflet page.

**Technical Implementation:**
- **Location:** `/leaflet/[competitionId]` page in Next.js app
- **Technology:** React + Tailwind CSS with print-optimized styling
- **QR Code:** Auto-generated using `qrcode` npm package (free)
- **Data Source:** Fetches from `promoteApi.getPromoteData()` endpoint
- **Fully Responsive:** Beautiful on screen, perfect for printing

**How It Works:**
1. Create competition in system → Get competition ID (e.g., 47)
2. Leaflet automatically available at: `https://lmslocal.com/leaflet/47`
3. Page fetches competition data (name, access code, join URL)
4. Auto-generates QR code from join URL
5. Displays in A4 print-ready format

**What's Included (Automatically):**
- ✅ Competition name (from database)
- ✅ Competition logo (from database, if provided)
- ✅ Access code (from database)
- ✅ Join URL (from database - points to main site)
- ✅ QR code (auto-generated - scans to main site)
- ✅ Entry fee (from database, with smart fallback)
- ✅ Prize structure (from database, with smart fallback)
- ✅ Start date (from round 1 lock_time, with smart fallback)
- ✅ Lives per player (dynamic rules text based on setting)
- ✅ How to join instructions (4-step process)
- ✅ Game rules (dynamic based on lives setting)
- ✅ Professional A4 layout
- ✅ Print-optimized CSS

**Smart Fallbacks (UK English):**
- Entry Fee: "Check with organiser" (if not set)
- Start Date: "Check with organiser" (if round 1 not configured)
- Prize: "Contact organiser" (if not set)
- All text uses British spelling throughout

**Your Workflow:**
1. Create competition → Note the competition ID
2. Access leaflet via promote page OR visit: `https://lmslocal.com/leaflet/[ID]`
3. Click "Print Leaflet" button
4. Save as PDF or print directly
5. Print 5 physical copies in office
6. Send leaflet URL to pub in initial "Done For You" message

**Quick Access:**
- From game dashboard → Promote → "View & Print" leaflet card
- Direct URL: `https://lmslocal.com/leaflet/[COMPETITION_ID]`
- Leaflet card hidden once round 1 starts (no longer needed for recruitment)

**Output Options:**
- **Screen View:** Beautiful preview with "Print" button
- **Print to PDF:** Browser's built-in print-to-PDF (free)
- **Direct Print:** Send to printer for physical copies
- **Shareable Link:** Pub can view online and print more themselves

**Physical Printing:**
- Use browser's print-to-PDF for the 5 copies
- Print directly in office OR send to local print shop
- Include leaflet URL in initial message for pub to print more themselves
- Post 5 physical copies to pub
- Future: Offer paid bulk printing service (50+ copies)

---

### STEP 4: Delivery Package - When They Respond Positively (5 mins - Day 1)

**Wait for:** Positive response to "Done For You" message (e.g., "OK", "Sounds good", "👍")

**IMPORTANT:** Don't send anything else until they acknowledge the initial message. Don't overwhelm.

**Once They Respond:**

**WhatsApp/Email Message:**

```
Great! I'm printing your leaflets today (5 copies) and posting them to you.

Quick Guide attached - it's just 1 page showing the 3 simple steps.

Also, here's the WhatsApp group link to share with your customers:
[WHATSAPP_GROUP_LINK]

I've already added you as admin in the group so you can manage it if you want - but I'll handle all the reminders and admin stuff if you prefer!

Leaflets should arrive in 2-3 days. Let me know when they turn up 👍
```

**Attachments (if Email):**
1. Quick Start Guide PDF (1 page - don't overwhelm)

**Actions:**
- Print 5 leaflets (print to PDF, then print physically)
- Post leaflets to pub address
- Add pub contact to WhatsApp group as admin
- Send WhatsApp group shareable link
- Attach Quick Start Guide if using email

**WhatsApp Group Management:**
- You are primary admin and manager
- Pub contact is also admin (for credibility and flexibility)
- You handle all reminders, updates, and player questions
- Pub can post if they want, but doesn't have to
- Share group link with pub to share with their customers

---

### STEP 5: Leaflet Arrival Follow-Up (5 mins - Day 3-5)

**Wait for:** Pub to confirm leaflets arrived OR 3-5 days after posting

**When Leaflets Arrive:**

**WhatsApp Message:**

```
Brilliant! Time to get the word out 📣

Pop those 5 leaflets up around the pub:
• On the bar
• On tables
• Notice boards
• Anywhere customers will see them

And share the WhatsApp group link with your regulars:
[WHATSAPP_GROUP_LINK]

I'll start welcoming players in the group as they join!

How many entries so far?
```

**If No Confirmation After 5 Days:**

```
Hi [Name],

Have the leaflets arrived yet? Should have been 5 copies.

Once they turn up, just pop them around the pub and share the WhatsApp group link with customers!

Let me know if you need anything 👍
```

**Goal:** Prompt action on promotion without being pushy

---

### STEP 6: Full Competition Management (Ongoing)

**You run the entire competition - pub can be hands-off if they want!**

**1 Week Before Start:**

**WhatsApp Message to Pub:**
```
Competition starts [DATE] - just 1 week to go! 🎯

How many entries do we have so far?

Give it a final push this week - share the join link and WhatsApp group with anyone who hasn't joined yet!

I'll handle all the reminders and admin from launch day 👍
```

**Launch Day:**

**WhatsApp Message to Pub:**
```
Good luck! Competition starts today 🍀

I'll be managing the WhatsApp group and sending pick reminders to all players.

You just collect the entry fees and enjoy the buzz!

Let me know if you need anything.
```

**WhatsApp Message to Players Group:**
```
🎯 ROUND 1 IS LIVE!

Get your picks in before [LOCK_TIME] on [DATE]

Remember: Win = stay alive, Draw/Loss = eliminated

Good luck everyone! ⚽
```

**During Competition (Weekly):**

**Your Responsibilities:**
- ✅ Send pick reminders to WhatsApp group before each round
- ✅ Post results updates after each round
- ✅ Answer player questions in group
- ✅ Handle any technical issues
- ✅ Track common questions for future improvements
- ✅ Keep energy and engagement high

**Check-in with Pub (Mid-Competition):**
```
How's it going? Competition at round [X] - [Y] players still alive!

Is the buzz good in the pub?

Let me know if you need anything 👍
```

**Post-Competition:**

**Message to Pub:**
```
Congratulations! Competition finished 🎉

Winner: [PLAYER_NAME]

How did it go? Would love your feedback!

Would you like to run another one? Could make it a regular thing 👍
```

**Actions:**
- Gather feedback (what worked, what didn't)
- Ask for testimonial if went well
- Offer next competition
- Document learnings for process refinement

---

## Quick Start Guide (1 Page - For Pub)

**File Location:** `docs/onboarding/quick-start-guide-template.md`

**Purpose:** Simple 1-page document sent to pub contact after they respond positively. Designed not to overwhelm.

**Key Features:**
- ✅ Competition details at top
- ✅ 3 simple steps (Promote, Collect Money, Relax)
- ✅ Emphasizes how little they have to do
- ✅ Clear "We'll Handle Everything Else" section
- ✅ Flexible involvement option (hands-on OR hands-off)
- ✅ Money disclaimer
- ✅ Support contact info

**Usage:**
1. Fill in placeholders for each competition
2. Convert to PDF or send as formatted WhatsApp message
3. Attach to Step 4 delivery message (don't send earlier)
4. Keep it simple - don't overwhelm with too much info at once

**Template includes:**
- Competition name, join link, access code, start date
- Entry fee and prize structure
- WhatsApp group link
- Clear division of responsibilities (what they do vs what you do)
- Contact details for support

---

## The Psychology Flip in Action

**Initial Contact:**
- ❌ Don't Ask: "What do you want? When? How much? What settings?"
- ✅ Present: "Your competition is READY! Here's what we've set up..."

**Competition Settings:**
- ❌ Don't Ask: "What entry fee do you want?"
- ✅ Present: "Entry fee: £10 (our most popular)" - no question needed

**Workload:**
- ❌ Don't Say: "You'll need to manage the competition..."
- ✅ Say: "I'll handle everything - you can be completely hands-off if you want!"

**Flexibility:**
- ❌ Don't Say: "You have to do X, Y, Z..."
- ✅ Say: "You can be hands-on OR hands-off - totally up to you!"

**When They're Frozen/Overwhelmed:**
- ❌ Don't Ask: More questions or wait for responses
- ✅ Present: "Forget those questions - it's all done! Here's what we built..."

**Key Learning:** Presenting finished product with "Done For You" messaging prevents decision paralysis. They review, not build from scratch.

---

## Timeline Template

**Day 0 (TODAY):**
- ✅ Create competition in system (FIRST - before contacting)
- ✅ Set all smart defaults (£10, 50/50 split, 2 weeks start)
- ✅ Create WhatsApp group and pin welcome message
- ✅ Note competition ID, join link, access code
- ✅ Send "Done For You" message to pub
- ✅ Wait for response (don't send anything else)

**Day 1 (When They Respond):**
- ✅ Send delivery package message with WhatsApp group link
- ✅ Print 5 leaflets (from leaflet URL)
- ✅ Post leaflets to pub address
- ✅ Add pub contact to WhatsApp group as admin
- ✅ Attach Quick Start Guide if using email

**Day 3-5 (When Leaflets Arrive):**
- ✅ Pub confirms arrival OR follow up after 5 days
- ✅ Prompt to put up leaflets
- ✅ Prompt to share WhatsApp group link
- ✅ Ask about entry numbers

**Week Before Start:**
- ✅ Check-in message
- ✅ Ask about entry numbers
- ✅ Remind to give final push on promotion
- ✅ Confirm you'll handle all admin from launch

**Launch Day:**
- ✅ "Good luck!" message to pub
- ✅ "Round 1 is live!" message to players group
- ✅ Monitor for issues
- ✅ Start full competition management

**During Competition (Weekly):**
- ✅ Send pick reminders before each round
- ✅ Post results updates after each round
- ✅ Answer player questions in WhatsApp group
- ✅ Mid-competition check-in with pub
- ✅ Keep energy high
- ✅ Document learnings

**Post-Competition:**
- ✅ Congratulations message to pub
- ✅ Feedback collection
- ✅ Ask for testimonial
- ✅ Offer next competition
- ✅ Process refinement

---

## Beta Phase Specifics

**Current Status:**
- Offer: FREE (normally £149)
- Customer: Inglenook Cafe
- Start Date: Saturday 22nd November 2025
- Goal: Learn and refine process

**Key Learning - Inglenook:**
- ❌ Asking questions = frozen contact (decision paralysis)
- ✅ Presenting finished product = unstuck and moving forward
- Build FIRST, contact AFTER with "Done For You" messaging

**No Waiting Policy:**
- Build competition immediately with smart defaults
- Don't wait for pub input
- Present finished product
- Changes can happen later (but rarely needed)

**Full Service Approach:**
- You run the entire competition (not just light support)
- Pub can be completely hands-off if they want
- Or hands-on if they prefer - it's their choice
- This is what makes the service valuable

**Communication:**
- WhatsApp preferred (faster, more personal)
- Email as backup/formal option
- Don't overwhelm with too much info at once
- Simple messages, clear next steps

**Support Level:**
- Full competition management for beta customers
- Weekly pick reminders, results updates, player support
- 100% available during testing
- Document what works and what doesn't
- Build scaled processes after beta

---

## Money Disclaimer

**Critical Messaging (Every Touchpoint):**

"All entry fees and prize money are collected and managed by you (the pub) completely independently of LMSLocal. We provide the platform and tools - you handle all financial transactions with your players."

**Where to Include:**
- Welcome email
- Delivery email
- Quick start guide
- WhatsApp pinned message
- Website terms (to be created)

**Legal:**
- Terms & Conditions to be drafted
- Clear separation of platform vs money handling
- No liability for prize disputes
- Pub is solely responsible

---

## Future Enhancements (Post-Beta)

**Not Needed Now - Document for Later:**

1. **Automated Onboarding:**
   - Self-service form
   - Auto-competition creation
   - Automated email sequences

2. **Design Automation:**
   - Template system
   - Auto-branded leaflets
   - Logo placement automation

3. **Support Scaling:**
   - FAQ system
   - Video tutorials
   - Chatbot for common questions
   - Tiered support levels

4. **Additional Services:**
   - Paid leaflet printing (50+ copies)
   - WhatsApp message templates
   - Social media post templates
   - Competition management training

5. **Tracking System:**
   - Onboarding dashboard
   - Customer status tracking
   - Support ticket system
   - Feedback collection forms

---

## Agent Handoff Checklist (Future)

**When you hire staff to do this:**

- [ ] Customer name and contact
- [ ] Competition name
- [ ] Access code
- [ ] Start date
- [ ] Entry fee amount
- [ ] Prize structure
- [ ] Logo file (if provided)
- [ ] Leaflet designed and sent
- [ ] 10 copies ordered and shipped
- [ ] WhatsApp group created
- [ ] Pub added as admin
- [ ] Delivery email sent
- [ ] Check-in scheduled
- [ ] Support contact provided

**Hand this document + checklist to your agent and they can execute**

---

## Success Metrics (Beta Phase)

**Track These:**
- Time to complete full onboarding
- Number of customer questions during setup
- Types of support requests during competition
- Customer satisfaction (informal feedback)
- What defaults get changed vs accepted
- Pain points and friction areas

**Don't Track Yet:**
- Financial metrics (it's free)
- Conversion rates (not selling yet)
- Retention (too early)

---

## Contact Information

**Support Email:** [TO BE ADDED]
**Support Phone:** [TO BE ADDED]
**WhatsApp Business:** [TO BE ADDED]

---

## Technical Implementation

### Automated Leaflet System ✅

**Built:** Fully automated digital leaflet generation system

**File Location:**
- `lmslocal-web/src/app/leaflet/[competitionId]/page.tsx`

**Technology Stack:**
- Next.js 15.5 page component
- React with TypeScript
- Tailwind CSS for styling
- `qrcode` npm package for QR generation (free)
- Print-optimized CSS with @media print queries

**Features:**
- ✅ Dynamic data fetching from existing API (`promoteApi.getPromoteData`)
- ✅ Auto-generated QR codes from join URLs
- ✅ A4 print-optimized layout (210mm x 297mm)
- ✅ Screen preview with "Print" button
- ✅ Responsive design (mobile-friendly viewing)
- ✅ Browser print-to-PDF support (no external services)
- ✅ Professional pub-friendly design
- ✅ Shareable URLs per competition

**How It Works:**
1. Competition created → Gets unique ID
2. Leaflet available at: `/leaflet/[competitionId]`
3. Page fetches: competition name, access code, join URL
4. Generates QR code client-side
5. Displays A4 leaflet with print button
6. User clicks "Print" → saves as PDF or prints directly

**Data Sources:**
- **From Database:** Competition name, logo URL, access code, join URL, entry fee, prize structure, start date (round 1 lock_time), lives per player
- **Smart Defaults:** British English fallback text when data not available
- **Auto-Generated:** QR code (points to main site)

**Implemented Features (v1.2):**
- ✅ Entry fee field in competitions table
- ✅ Prize structure field in competitions table
- ✅ Start date from round 1 lock_time
- ✅ Competition logo support (logo_url field)
- ✅ Dynamic rules text based on lives_per_player setting
- ✅ Horizontal logo layout matching game dashboard
- ✅ British English fallback text throughout

**Future Enhancements (Post-Beta):**
- Server-side PDF generation (Puppeteer)
- Automated PDF email attachments
- Custom branding colors per competition
- Multiple template styles
- Venue address and contact info on leaflet

**Cost:** $0 - Uses only free, built-in technologies

---

## Version History

- **v1.0** - Initial plan for Inglenook Cafe beta (Free)
- **v1.1** - Automated leaflet system implemented (uses free tools)
- **v1.2** - Enhanced leaflet with database-driven content (entry fee, prize structure, start date, logo support, dynamic rules, British English fallbacks)
- **v1.3** - Major process overhaul based on Inglenook learnings:
  - Flipped approach: Build competition FIRST, contact pub AFTER
  - "Done For You" messaging to prevent decision paralysis
  - Added "Unstick Message" template for frozen contacts
  - WhatsApp-first communication strategy
  - Full competition management service (hands-off option for pubs)
  - Reduced to 5 leaflets (office printing)
  - Created Quick Start Guide template
  - Pub as admin in WhatsApp group
  - Comprehensive message templates for entire lifecycle
- Future versions will incorporate learnings from completed competitions

---

## Notes & Learnings

**Add notes here as you go through beta:**

### Inglenook Cafe
- **Date Started:** November 2025 (in progress)
- **Competition Start:** Saturday 22nd November 2025
- **Status:** Building competition and preparing to send "Done For You" message

**Early Learnings (Pre-Launch):**
- ❌ **What Didn't Work:** Asking questions upfront ("What do you want?") caused decision paralysis and frozen contact
- ✅ **Solution:** Flipped approach to build competition FIRST, then present finished product with "Done For You" messaging
- ✅ **Better Approach:** "Forget those questions - it's all done!" unstick message strategy
- 📝 **Key Insight:** Presenting finished product prevents overwhelm and gets positive response

**Process Improvements Made:**
1. Changed from 10 to 5 leaflets (easier to print in office)
2. WhatsApp-first communication (faster, more personal)
3. Pub as admin in WhatsApp group (credibility + flexibility)
4. Full competition management service (not just light support)
5. Created Quick Start Guide template (1 page, non-overwhelming)
6. Added "Unstick Message" template for frozen contacts

**What Worked:**
- (To be filled in during competition)

**What Didn't Work:**
- (To be filled in during competition)

**Changes to Make:**
- (To be filled in during competition)

**Future Customers:**
- (Add next beta customer details here)

---

**Last Updated:** 6th November 2025
**Status:** Active - Beta Testing (Inglenook in progress)
**Next Review:** After Inglenook completion
