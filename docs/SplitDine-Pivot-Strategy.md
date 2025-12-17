# SplitDine Pivot Strategy

## The Core Insight

**The pain is with the restaurant, not the diner.**

Diners queue for 5 minutes to pay separately - mildly annoying but not worth adopting a new tool. The restaurant deals with:

- Staff tied up for 20 minutes splitting a bill for 16 people
- Table turnover slowed during peak hours
- Deposits chased manually, no-shows eating profit
- Pre-orders miscommunicated, wrong dishes sent out
- Phone ringing constantly in December for party bookings
- Spreadsheet chaos for tracking who's paid what

The diner's inconvenience is the restaurant's operational nightmare - multiplied by every group booking they take.

---

## Current vs. Repositioned

| Current | Repositioned |
|---------|--------------|
| "Organise your group meal" | "Manage your group bookings" |
| Host creates event | Restaurant creates booking link |
| Free for consumers | £29/month for restaurants |
| Host invites friends | Restaurant sends link to customer who booked |
| Collect deposits from mates | Secure deposits, reduce no-shows |
| Track who owes what | Pre-orders, dietary reqs, payment status dashboard |

**The features are mostly the same. The buyer is different.**

---

## Market Gap

Existing tools (Eviivo, ResDiary, OpenTable, DesignMyNight) handle "table for 4 at 7pm."

They don't handle:
> "Party of 18, £20 deposit each, pre-orders needed, 3 vegetarians, paying separately on the night"

That's still done with phone calls, emails, spreadsheets, and hope.

---

## Implementation Plan

### Phase 1: Reposition (1-2 days)

- New landing page aimed at restaurants, not consumers
- Headline: something like "Group bookings without the spreadsheet chaos"
- Change "Create an event" to "Create a booking"
- Add a demo/example showing a pub's dashboard view
- Speak to their pain: deposits, no-shows, pre-orders, December stress

### Phase 2: Restaurant Dashboard (2-3 days)

Multi-booking view replacing single-event focus:

**Dashboard should show:**
- List of upcoming group bookings
- For each booking: name, date, party size, deposits paid/pending, pre-orders status
- Summary stats: "£340 deposits collected", "3 bookings awaiting payment", "12 guests confirmed"
- Quick actions: send reminder, view details, copy booking link

**Key difference from current:**
- Restaurant sees ALL their bookings at a glance
- Not one event at a time

### Phase 3: White-Label Customer Experience (1 day)

When a guest clicks the booking link, they should see:
- The restaurant's name prominently: "The Nags Head - Confirm Your Booking"
- NOT "SplitDine" branding
- The restaurant is the brand, SplitDine is invisible infrastructure

Guest flow:
1. Receive link from restaurant (email/text)
2. See booking details (date, time, menu options)
3. Confirm attendance
4. Pay deposit
5. Select menu choices / dietary requirements
6. Done

### Phase 4: Pricing Page

**Suggested pricing:**
- £29/month or £249/year (save ~30%)
- Possibly: "Free during December beta" to reduce friction for first sign-ups

**What's included:**
- Unlimited group bookings
- Deposit collection (Stripe)
- Pre-order management
- Guest communication
- Dashboard & reporting

---

## Go-To-Market Approach

### The Prototype-First Strategy

Don't cold pitch. Send a working example:

> "Hi, I've built a tool for managing group bookings and deposits. I've mocked up how it would look for [Pub Name]. No obligation - just thought you might find it interesting ahead of Christmas: [link]"

This mirrors the website prototype approach - show, don't tell.

### Timing

**Now is the perfect window.** Pubs are starting to think about Christmas party bookings. By mid-October they're drowning. Approach them in the next few weeks while they can still onboard before the rush.

### Target Customers

Start with gastropubs and venues that:
- Do significant food trade (not just wet-led pubs)
- Handle private dining / party bookings
- Are operationally savvy (already use some digital tools)
- Have 50+ covers capacity

Examples from research:
- The Nags Head, Garthmyl (AA 5-star, Rosette, does events)
- The Abermule Inn (award-winning, events, camping)

---

## Success Metrics

**Validation (first 3 months):**
- 5 pubs using the system (even if free/discounted)
- At least 50 group bookings processed
- Qualitative feedback: "this saved us hours"

**Revenue (6 months):**
- 20 paying customers at £29/month = £580 MRR
- Target: enough to justify continued development

---

## Key Messaging

**For restaurants:**
- "Christmas party bookings without the chaos"
- "Collect deposits automatically. No more chasing."
- "Know exactly what everyone's eating before they arrive"
- "Your customers get a simple link. You get a dashboard."

**The pitch in one line:**
> "Send your customers a link. They confirm, pay their deposit, and choose their menu. You see it all in one dashboard."

---

## What NOT to Change

The core mechanics of SplitDine likely work:
- Event/booking creation
- Guest invitations
- Deposit/payment collection
- Menu selection

The product exists. This is a repositioning and UI restructure, not a rebuild.

---

## Questions to Resolve

1. Is the current payment integration (Stripe?) ready for restaurant payouts?
2. How much white-labelling is feasible quickly?
3. Can we create a "demo mode" for a fake pub to show prospects?
4. What's the minimum viable dashboard for Phase 2?

---

## Summary

SplitDine is built. The technology works. The pivot is:

1. **Change the buyer** - restaurants, not consumers
2. **Change the framing** - operational tool, not social app
3. **Change the pricing** - B2B subscription, not free consumer product
4. **Change the branding** - white-label for the venue

Then approach pubs with a working prototype of "their" booking system, timed for Christmas party season.
