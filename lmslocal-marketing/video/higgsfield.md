# Higgsfield — notes towards the cartoon promo

**Status as of 2026-09-12: nothing bought, nothing briefed.** This is the thinking, so the
decision does not have to be re-made from scratch. Pick it up before or during the first paid
month.

**The intention: a cartoon promo, made by Andreas and Claude together.** Not a replacement for
`film.html` — a different film for a different job.

## Why an outside tool at all

`film.html` is a good pipeline and it costs nothing to render. It cannot do this one thing:
**Claude cannot draw.** Hand-written SVG and CSS give you typography, geometry and motion. They
do not give you a landlord behind a bar, punters, or faces. Anything cartoon-shaped attempted in
the existing pipeline comes out reading as a diagram.

That is the whole case for paying someone. It is not polish and it is not atmosphere — it is a
capability that is absent, and no amount of pipeline work closes it.

## The economics, which are the easy part

One month of Ultra is $129; Plus is $59. Against an agency's low thousands for an animated 30s,
or Fiverr's revision ping-pong with someone who has to be taught what last-man-standing is, that
is good value with more control and a faster loop.

**Subscribe, make the film, cancel, resubscribe when the next one is needed.** Annual billing is
a 30% saving and the wrong shape — the open question is whether the style lands, and that is a
one-month question, not a one-year one.

**Month two is cheaper than month one**, because the trained character carries over. That is only
true if the assets are pulled down — see the checklist.

## Prices seen on 2026-09-12

A **30% OFF promotional banner was running**, so treat these as a snapshot, not a quote.

| | Starter | Plus | Ultra |
|---|---|---|---|
| Billed annually | $19/mo | $47/mo | $99/mo |
| Billed monthly | — | $59/mo | $129/mo |
| Credits | 270/mo | 1,200/mo | 3,000/mo |
| Concurrent jobs | 2 | 6 | 8 |
| Seedance 2.0 | no access | 2.5 1080p + 2.0 4K | full line-up |
| Unlimited (7-day windows) | none | Kling 3.0, Nano Banana 2 | + Nano Banana Pro |

Plus is quoted at roughly 640 Seedance 2.0 720p videos or 320 at 1080p; Ultra at 1,600 and 800.

**270 credits does not buy a film.** It is ~15 short generations, and AI video takes several
attempts per usable shot. Starter is for looking around, not for making something.

## Plus vs Ultra — genuinely open, and the earlier call was wrong

The first recommendation here was Ultra, reasoning that Nano Banana Pro unlimited is Ultra-only
and that stills are where character consistency lives.

**That reasoning is unproven and probably wrong.** Higgsfield has a dedicated character-training
tool — `soul` — and the pricing page showed **5,000 free Soul 2.0 generations included on Plus**.
If Soul is the real mechanism for holding a character across shots, then Plus covers the hard
part at $59 and the Ultra argument collapses.

**Resolve this before buying:** what does Soul cost per plan, and is character consistency
actually a Soul job or a Nano Banana Pro job? Everything else about the two plans is a volume
difference, and volume is not the constraint.

## Verified facts (checked 2026-09-12, not inferred)

**Unlimited never applies outside the website.** Their help centre: *"Unlimited access applies
only on higgsfield.ai: outside it, generations always deduct credits."* MCP, CLI, Canvas and
Supercomputer are all excluded, on every plan. Unlimited is for manual use by design.

**There is a CLI aimed at coding agents, Claude Code named explicitly.**

```
npx skills add higgsfield-ai/skills
higgsfield auth login          # OAuth, no API key
/higgsfield:generate
```

Three skills: `generate` (images and video), `soul` (character training), `product-photoshoot`.
They recommend CLI over MCP for coding agents — lower token overhead, structured output. MCP is
the chat-client route, hosted at `mcp.higgsfield.ai/mcp`.

**Every CLI generation costs credits.** So Claude driving the tool spends the budget that paying
for unlimited was meant to avoid.

Sources: [CLI access](https://higgsfield.ai/creator-hub/help-center/mcp-cli/how-do-i-access-higgsfield-via-cli) ·
[Unlimited models](https://higgsfield.ai/creator-hub/help-center/credits/what-are-unlimited-models-and-which-plans-include-them) ·
[MCP overview](https://higgsfield.ai/mcp)

## The division of labour that follows

- **Web, Andreas, unlimited** — character training and stills iteration. High volume, needs a
  human eye on whether the character looks right, and free at the margin. This is where the value
  of the subscription actually sits. Claude supplies prompts as plain text to paste.
- **CLI, Claude, metered** — final shot generation once the character is settled. Low volume, and
  being programmatic buys consistent naming, files landing straight on disk, and a reproducible
  run.
- **Local, Claude, free** — assembly. Cutting clips, burning captions, flipping the real
  screenshots in, ffmpeg.

**Do not let Claude burn credits on the part that is free in a browser.** That is the one way to
waste the month.

## Putting the real product in

The promo does not need AI to render an app screen, and must not try.

- **Hard cut to a real screenshot**, full frame, 1.5–2s with a caption, then back to cartoon.
  Standard ad grammar, no technical risk, unambiguously the real product. This is the one to use.
- Compositing into a generated phone is possible **only if the shot is static** — ask for a hand
  holding a blank phone and drop the screen in. A moving camera means motion tracking, which is
  where this falls apart.

`video/shots/` already holds real screenshots cropped to the app's own column. Re-shoot rather
than re-crop if a screen has changed since.

## Before buying

1. Settle the Soul question above — it decides Plus vs Ultra.
2. Write the shot list and character brief **first**. Day one of the subscription should be
   generating, not deciding what to generate. This is free and it is the highest-leverage thing
   available. It belongs in `ai-brief/`.
3. Confirm prices on the live page; the ones above were mid-promotion.

## During the month

- **Pull everything down before cancelling.** Stills, clips, and the trained character above all.
  Do not assume a cancelled account's library stays reachable. The trained character is what
  makes month two cheap.
- Watch for throttling — unlimited is fair-use and they warn of "dynamic speed adjustments during
  high-traffic periods."

## Loose end

`README.md` describes an `ai-brief/` folder that **does not exist and has never been tracked**.
Writing the brief there would make that sentence true; otherwise the reference should go. A
"No stock photography" rule was removed from that README on 2026-09-12 — it was written by
Claude, not by Andreas, and had started being quoted back at him as though it were his own
constraint. Watch for others of the same kind.
