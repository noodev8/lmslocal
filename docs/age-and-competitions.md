# Age and competitions — reference

**Status: a record of a discussion, not a decision and not a spec.** Nothing here is built.
Written 2026-08-25 between Andreas and Claude, prompted by the idea of LMSLocal running a
competition across its whole user base rather than an organiser running one for their pub.

Not legal advice. It follows the site's own rule for `/help/is-it-gambling` — explain the shape
of the rules, do not guarantee anyone's position.

---

## Where we are today

- `routes/register.js` collects **display name, email and password only**. Deliberate: joining
  friction is what is being optimised while the user base grows, and it has worked.
- **No age data exists anywhere.** Checked against the live schema on 2026-08-25 — no `dob`,
  no `date_of_birth`, no age column on `app_user`, `competition` or `competition_user`.
- We carry **no advertising** and are not pursuing it. See `revenue-options-notes.md`.

So there is nothing to migrate and nothing to undo. Everything below is greenfield.

---

## The question that came up

If LMSLocal runs a competition open to every user, **do we need to know they are over 18, or can
the restriction live on the competition itself?**

## The prior question, which matters more

Running a competition ourselves changes what we are, for that competition. `/help/is-it-gambling`
rests on our not being part of anyone's arrangements — we supply the software, the organiser runs
the thing. Run one ourselves and we are the promoter of it.

Which branch we are on decides the age answer:

- **Free to enter, prize funded by us** → a free prize draw, outside the Gambling Act, because
  there is no payment to enter. No licence needed, and **no statutory 18+ requirement** — free
  draws are not gambling, so the gambling age limit does not attach to them.
- **Any entry fee with a prize** → we are promoting a lottery or a prize competition, and which
  one it is has to be established. Different conversation, considerably more expensive.

**The assumption throughout the rest of this doc is the free branch**, since a house competition
is an engagement play rather than a revenue one. If that ever stops being true, none of what
follows is sufficient.

### So 18+ would be a choice, not a requirement

On the free branch the law does not make us ask. Reasons we might anyway:

- **The prize.** Anything alcohol- or betting-branded carries its own age restriction regardless
  of how the competition is classified.
- **Optics.** A competition LMSLocal publicly runs is different from one a landlord runs, and
  minors in it is a headline we would rather not have.
- **Organisers' own position.** A pub competition with an entry fee and a cash pot is on shakier
  ground than our free one, and organisers may want the control for themselves.

---

## The shape we landed on

**The restriction belongs to the competition. The answer belongs to the person.**

1. **A `min_age` flag on `competition`.** The restriction is genuinely a property of the
   competition — it is the competition that has the prize and the entry condition, not the user.
2. **On joining a restricted competition, the player confirms once.** Not at registration.
   Registration-time age tax would fall on every signup to serve a minority of competitions,
   which is exactly the friction that was deliberately removed.
3. **The confirmation is stored on `app_user`**, not on the membership row — something like
   `age_confirmed_18` plus a timestamp. A per-membership tick would re-ask the same person for
   every competition, and would answer no useful question afterwards.

### Why store it on the user rather than the join

Two reasons, and the second is the one that is easy to miss:

- **Nobody gets asked twice.** First restricted competition asks; every one after that does not.
- **It accumulates an audience sample.** The gambling 25% rule (no medium may carry gambling ads
  if more than 25% of its audience is or is likely to be under 18) is an audience-**composition**
  test. A tick on a membership row cannot contribute to it; a flag on the user can. This is not a
  reason to build it — advertising is parked — but it means the cheap version is also the one
  that does not have to be rebuilt if that ever changes.

### Confirmation, not date of birth

**Store a boolean, not a date.** Nothing described here needs to know how old anyone is, only
whether they are over 18. A DOB is more sensitive, harder to justify holding, and worse to lose.
"I confirm I am 18 or over" answers every question actually being asked.

---

## Left open

- **Whether we run a house-wide competition at all**, and if so whether it is genuinely free to
  enter. The whole analysis above depends on that answer.
- **Whether organisers get `min_age` too.** Probably wanted, but offering a compliance-shaped
  control means the help pages have to be clear that the tickbox is the organiser's assurance
  about their competition, not ours about their players.
- **What a self-certified confirmation is actually worth.** Nobody verifies age; the industry
  norm is to self-certify and move on. Worth being honest about that in any copy rather than
  implying a check happened.
- Everything about advertising, which stays parked. See `revenue-options-notes.md`.
