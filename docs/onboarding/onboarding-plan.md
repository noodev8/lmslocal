# LMSLocal Onboarding Plan v1.0

**Status:** Active (Free Beta Testing)
**Current Customer:** Inglenook Cafe
**Offer:** Free setup (normally £149)
**Goal:** Learn and refine process before paid rollout

---

## Core Philosophy

**"Done For You" Approach:**
- Use smart defaults for everything
- Don't wait for customer input
- Launch with sensible settings even if pub provides zero information
- Customers review decisions rather than make them from scratch

**Psychology Flip:**
❌ Don't ask: "What do you want?"
✅ Instead say: "We've set this up with our best practices - let us know if you'd like changes"

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

### STEP 1: Initial Contact (5 mins)

**Send Simple Welcome Message:**

```
Welcome to your free Last Man Standing setup! 🎉

We're building your competition now with our most popular settings. It'll be ready in 48 hours.

Quick question (optional - we'll use defaults if we don't hear back):
- Pub name for the competition: [PUB NAME]
- Preferred start date: [Suggest date 2 weeks out]
- Entry fee you're planning: [£10 suggested]
- Prize goes to: Winner / Charity split OR Winner takes all?
- Got a logo? (Attach if yes)

Don't worry if you're busy - we'll set sensible defaults and you can tweak later.

Speak soon!
```

**Action:** Send immediately, don't wait for response

---

### STEP 2: Competition Build (30 mins - Day 0)

**Manual Setup in LMSLocal:**
1. Create competition: "[Pub Name] Last Man Standing"
2. Set access code: Memorable format (e.g., "INGLENOOK2025")
3. Start date: 2 weeks from today
4. Configure: Entry fee £10, standard Premier League fixtures
5. Generate join link
6. Note competition ID and access code

**Required Information:**
- Pub name (minimum)
- Everything else uses defaults

**Deliverables:**
- Competition URL
- Access Code
- Admin login (if needed)

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
- ✅ Access code (from database)
- ✅ Join URL (from database)
- ✅ QR code (auto-generated)
- ✅ How to join instructions
- ✅ Game rules (4 key points)
- ✅ Professional A4 layout
- ✅ Print-optimized CSS

**What's Default Text (Can Update Later):**
- "Entry Fee: Contact organizer"
- "Starts: Check with organizer"
- "Prize: To be confirmed"

**Your Workflow:**
1. Create competition → Note the competition ID
2. Visit: `https://lmslocal.com/leaflet/[ID]`
3. Click "Print Leaflet" button
4. Save as PDF or print directly
5. Send PDF to printer for 10 physical copies
6. Send leaflet URL to pub in delivery email

**Output Options:**
- **Screen View:** Beautiful preview with "Print" button
- **Print to PDF:** Browser's built-in print-to-PDF (free)
- **Direct Print:** Send to printer for physical copies
- **Shareable Link:** Pub can view online and print more themselves

**Physical Printing:**
- Use browser's print-to-PDF for the 10 copies
- Send PDF to local print shop OR online printer
- Include leaflet URL in delivery email for pub to print more
- Future: Offer paid bulk printing service (50+ copies)

---

### STEP 4: WhatsApp Group Setup (10 mins - Day 2)

**Process:**
1. Create WhatsApp group: "[Pub Name] LMS"
2. Get pub contact number
3. Add pub contact to group
4. Make pub contact admin
5. Pin welcome message (see template below)

**Pinned Message Template:**

```
Welcome to [Pub Name] Last Man Standing!

Join the competition: [LINK]
Access Code: [CODE]
Start Date: [DATE]

Rules: Pick one team each week, win to stay alive. Don't repeat teams. Good luck! ⚽
```

**Admin Strategy:**
- Create on your business WhatsApp number
- Invite pub as admin
- Pub can invite their customers
- Pub can rename group if desired
- You can leave group at end of competition

**Flexibility:**
- If pub wants to create their own group, that's fine
- Provide template messages they can use
- No waiting - you create by default

---

### STEP 5: Delivery Package (1 Email - Day 2)

**Email Subject:** "Your Last Man Standing Competition is LIVE! 🎯"

**Email Body Template:**

```
Hi [Contact Name],

Your competition is ready! Here's everything:

🔗 Join Link: [URL]
🔑 Access Code: [CODE]
📅 Start Date: [DATE]
💰 Entry Fee: £10 (you collect this)

📄 PROMOTIONAL LEAFLET:
View and print: https://lmslocal.com/leaflet/[COMPETITION_ID]
(We're also posting 10 printed copies to you)

WHAT WE'VE DONE:
✅ Built your competition
✅ Created your promotional leaflet (link above)
✅ Set up WhatsApp group (link below)
✅ Printed 10 leaflets for you

WHAT YOU DO:
1. Use the leaflet link above to print more copies if needed
2. Join the WhatsApp group: [LINK]
3. Share with your customers!

MONEY STUFF:
You collect entry fees and handle prizes - we never touch the money. It's your show!

All money collection and prize distribution is managed by you, independently of LMSLocal.

NEED HELP?
Just reply to this email or call [YOUR NUMBER]

Good luck! 🍀
[Your Name]
```

**Email Attachments:**
1. Leaflet PDF (print-ready - generated from leaflet page)
2. Quick Start Guide (1 page - see below)

**Note:** The leaflet PDF is generated by printing the leaflet page to PDF. The pub also gets the leaflet URL so they can view online and print more copies themselves.

---

### STEP 6: Light Touch Support (Ongoing)

**1 Week Before Start:**
- Quick message: "Competition starts [DATE] - how many sign-ups so far?"
- Offer help with questions
- Check they've received printed leaflets
- Remind about WhatsApp group

**Launch Day:**
- "Good luck!" message
- Monitor for any issues
- Be responsive to questions

**During Competition:**
- Available for support questions
- Track what support is actually needed
- Document common questions
- Learn pain points

**Post-Competition:**
- Check how it went
- Gather feedback
- Ask for testimonial
- Offer next competition

---

## Quick Start Guide (1 Page - For Pub)

**YOUR COMPETITION IS READY!**

**Competition Details:**
- Name: [COMPETITION NAME]
- Join Link: [URL]
- Access Code: [CODE]
- Start Date: [DATE]
- Entry Fee: [AMOUNT]

**3 Simple Steps:**

**1. PROMOTE**
- Use the leaflet (we've sent 10 copies + digital file)
- Put on bar, tables, notice boards
- Share on social media
- Tell your regulars!

**2. COLLECT ENTRIES**
- Players join online using link/code
- You collect entry fees your way (cash, transfer, etc.)
- Important: All money stays with you - we never touch it

**3. JOIN WHATSAPP GROUP**
- Link: [WHATSAPP LINK]
- You're the admin - you control it
- Chat with players, remind about picks, build excitement

**Money Management:**
⚠️ You are 100% responsible for entry fees and prizes
⚠️ We provide the platform only - no money through us
⚠️ Track entries and maintain your own records

**Support:**
- Email: [SUPPORT EMAIL]
- Phone: [SUPPORT NUMBER]

---

## The Psychology Flip in Action

**Entry Fee:**
- ❌ Don't Say: "What entry fee do you want?"
- ✅ Say: "We've set your entry fee to £10 - that's what works best for most pubs. Let us know if you'd prefer something different."

**Charity Split:**
- ❌ Don't Say: "Do you want to give to charity?"
- ✅ Say: "We've configured 50% to winner, 50% to charity (great for marketing!) - but it's totally up to you how you split the prizes."

**Start Date:**
- ❌ Don't Say: "When do you want to start?"
- ✅ Say: "Your competition starts on [DATE] - does that work or would you prefer a different week?"

**Key:** They review decisions, not make them from scratch. 90% will just say "looks good!"

---

## Timeline Template

**Day 0 (TODAY):**
- ✅ Send welcome message to pub
- ✅ Create competition in system
- ✅ Start leaflet design

**Day 1 (TOMORROW):**
- ✅ Finish leaflet design
- ✅ Send to printer (10 copies)
- ✅ Prepare delivery email package

**Day 2:**
- ✅ Send delivery package email
- ✅ Set up WhatsApp group
- ✅ Add pub contact as admin
- ✅ Leaflets shipped

**Week Before Start:**
- ✅ Check-in message
- ✅ Verify sign-ups
- ✅ Confirm they're ready

**Launch Day:**
- ✅ "Good luck!" message
- ✅ Be available for support
- ✅ Monitor for issues

**During Competition:**
- ✅ Light touch support
- ✅ Document learnings

**Post-Competition:**
- ✅ Feedback collection
- ✅ Process refinement

---

## Beta Phase Specifics

**Current Status:**
- Offer: FREE (normally £149)
- Customer: Inglenook Cafe
- Goal: Learn and refine process

**No Waiting Policy:**
- Start even if pub hasn't answered anything
- Use defaults
- Changes can happen later

**No Refunds:**
- It's free anyway
- Using experience to learn
- Will formalize refund policy for paid customers

**Documentation:**
- Don't over-document yet
- Learn from free entries first
- Refine based on real feedback
- Build formal processes after beta

**Support Level:**
- Full support for beta customers
- 100% available during testing
- Document what support is actually needed
- Build scaled support later

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
- **From Database:** Competition name, access code, join URL
- **Hardcoded Defaults:** Entry fee text, start date text, rules
- **Auto-Generated:** QR code

**Future Enhancements (Post-Beta):**
- Add entry_fee field to competitions table
- Add start_date field to competitions table
- Add pub_logo field to competitions table
- Server-side PDF generation (Puppeteer)
- Automated PDF email attachments
- Custom branding per competition
- Multiple template styles

**Cost:** $0 - Uses only free, built-in technologies

---

## Version History

- **v1.0** - Initial plan for Inglenook Cafe beta (Free)
- **v1.1** - Automated leaflet system implemented (uses free tools)
- Future versions will incorporate learnings

---

## Notes & Learnings

**Add notes here as you go through beta:**

### Inglenook Cafe
- Date started:
- Learnings:
- What worked:
- What didn't:
- Changes to make:

---

**Last Updated:** [DATE]
**Status:** Active - Beta Testing
**Next Review:** After Inglenook completion
