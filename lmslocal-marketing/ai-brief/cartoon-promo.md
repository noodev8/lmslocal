# Cartoon promo — the brief

**Status: approved as a story, nothing generated.** Written 2026-09-12, before any subscription
was bought, which is the point of it.

A ~65 second animated film for the **website**, not the feed. Separate from `../video/film.html`,
which is 25s, silent and square for Facebook. This one does the job that film cannot: it shows
the room.

---

## 1. Why this film exists

`film.html` makes the argument and shows the product, and it is good at both. What it cannot do
is put a person on screen. The leaflets *assert* that a pub runs this and the regulars love it;
nothing we own *shows* it.

So the whole of this film is the thing only a cartoon can carry — faces, a wind-up, someone
gutted, someone smug — and the product appears for about six seconds in total as **real
screenshots, hard cut in**. If a scene here could have been built in HTML and CSS, it is the
wrong scene.

## 2. The spine

**The landlord starts as the machinery and ends as a spectator.**

Week one he *is* the scoreboard: biro behind the ear, curling sheet by the optics, nagged mid-pour
by two regulars who both want to know if they are still in. By the last scene he is leaning on
his own bar with a pint watching those same two tear lumps out of each other, and the thing is
running without him.

That is the leaflet's line dramatised instead of captioned:

> You used to keep that behind the bar — now it keeps itself.

**Point of view is the landlord's throughout.** He is who buys. Dave and Sarah are the comedy and
they are always something he is watching.

## 3. Characters

Three, and only three, with names. Everyone else is a body in a pub.

**The landlord.** Fifties, been there twenty years, not a caricature and not a grump — dry, fond
of them, tired of being the scoreboard. Shirt sleeves rolled. He is the only character whose
*face* has to carry a beat on its own (the pint over the sheet), so he is the one to train first
and the one to spend the most stills on.

**Dave M.** Loud one. Forties, big, sits at the same stool, certain he is right. Picks with his
heart, which is what kills him. He loses, and the film is funnier for it.

**Sarah K.** Thirties, quieter, drinks with the same crowd and is better at this than any of them.
She wins. She is also why the bar does not read as a room of blokes — which matters, because a pub
full of men is both untrue and a smaller market.

> **Dave M. and Sarah K. are already in the print work** — they are two of the names on the
> survival sheet in `../leaflet/a5-landlord.html` and in scene 1 of `../video/film.html`, with
> Arsenal and Brighton against them. Same names in the leaflet, the film and the cartoon is free
> continuity. Their teams in this film must stay Arsenal and Brighton for the same reason.

**The bar itself is the fourth character.** One camera position on it recurs through the season
montage, and what changes is coats, a Christmas string, a different shirt. Establish the geometry
of that bar early and hold it: it is the cheapest way to sell time passing, and the hardest thing
to recover if the generated backgrounds drift.

## 4. Beat sheet

| Time | Scene | What happens |
|---|---|---|
| 0:00–0:10 | **The sheet era** | Behind the bar. Biro behind his ear, curling sheet gaffer-taped by the optics. Dave and Sarah both leaning over it talking at him at once while he pulls a pint one-handed. He gets the pint wrong. |
| 0:10–0:16 | **The turn** | An elbow puts a pint over the sheet. The ink runs. Long look from the landlord. Caption lands. |
| 0:16–0:24 | **He sets it up** | Empty afternoon, chairs on tables, phone on the bar. **Screenshot: create.** Back to him, done, unimpressed at how little happened. |
| 0:24–0:32 | **Getting them in** | Join code chalked on the board by the taps. Phones up round the bar. **Screenshot: join code, list filling.** Dave and Sarah reach it at once and shoulder each other out of the way. |
| 0:32–0:48 | **The season** | The recurring bar shot, weeks passing. Dave smug, Sarah gutted; next week reversed. The Arsenal exchange (§5) teaches the no-reuse rule. **Screenshot: standings updating.** The landlord pours throughout and never picks up a pen. |
| 0:48–0:58 | **Last man standing, literally** | The bar thins week by week in the same frame — the knocked-out stay, but they are spectators now, jeering. Down to Dave and Sarah. One result. Dave slumps. |
| 0:58–1:05 | **End card** | He wipes the bare patch of wall where the sheet used to be. Nothing there. Headline, two figures, URL. |

**Captions burned in throughout**, even though this film has sound. A cut-down for the feed is the
obvious second use, and captions cannot be added later without re-rendering the picture.

Caption copy is the film's and the leaflet's, unchanged:

- 0:10–0:16 — *You used to keep that behind the bar.* → *Now it keeps itself.*
- 0:16–0:24 — *Setting up takes about five minutes.*
- 0:24–0:32 — *They join with a code. They pick on their phones.*
- 0:32–0:48 — *Matches and results load themselves.* → *Eliminations sort themselves out.*
- End card — *Run last man standing at the bar* / *20 players free* / *No card. Matches and
  results included.* / `lmslocal.co.uk`

## 5. Dialogue

About 55 words in total, and it should stay that way.

**The landlord never pitches.** He does not say one word about the app. The punters ask; he
points. His arc is saying less in every scene.

**Sheet era** — both at him at once, over the pump.

> **Dave:** Am I still in?
> **Sarah:** You're still in.
> **Dave:** I want to see it.
> **Landlord** *(not looking up)*: You're still in, Dave.

**The pint goes over.** Nobody speaks. Three seconds of ink running. Then, small:

> **Sarah:** …I'll get a cloth.

**Setup**, alone. One line, to himself, at the end:

> **Landlord:** That's it?

**The code.** Dave arrives at the bar.

> **Dave:** What's the code?

No answer. The landlord points at the chalkboard with the hand holding the glass, without looking
up. First time he has refused to be the machinery, and the film's hinge.

**The season** — four lines, and they teach the rule that no caption has ever taught well.

> **Dave:** Arsenal.
> **Sarah:** You've had Arsenal.
> **Dave:** I've not had Arsenal.
> *(Sarah turns her phone round.)*
> **Dave:** …When did I have Arsenal?

**The finish.**

> **Dave:** *Brighton?*
> **Sarah:** Brighton.

**End**, over him wiping the bare wall.

> **Punter (off):** Same again next season?
> **Landlord:** Same again.

## 6. How dialogue gets made, which is not how it looks

**Lip-sync is the least reliable thing these tools do**, and a mouth flapping out of time reads
cheap instantly — worse than silence, because everything else in the film is trying to look
deliberate. The whole of §5 is therefore written to be shot around mouths.

- **Voice is cut in afterwards, locally, with ffmpeg.** It is not generated with the video. That
  keeps it free, re-recordable, and re-castable without re-rendering a frame.
- **Design the shot so the mouth is not the shot.** Back of head, over-shoulder, hands and pumps
  with the line off-frame, or cut to the *listener's* face while the line lands. The shot list
  marks this per shot.
- **Only two lines want a visible mouth** — "That's it?" and "Brighton." — and both are one word
  or close to it. If lip-sync is not usable even at that length, both work as reaction shots and
  nothing in the film breaks.
- **Never two lines in one generated clip.** One line, one clip, always.
- **Keep every line under about two seconds.**

## 7. Shot list

Roughly 14 generated shots plus 3 screenshot cuts. AI video generates in 5–8s clips, so this is
the real credit estimate — several attempts per usable shot is normal, and the montage is where
that multiplies.

`MOUTH` column: **no** = speaker off-frame or turned away, line cut in afterwards. **1 word** =
a visible mouth is wanted but the line is short enough to survive a bad take.

| # | Scene | Shot | Mouth |
|---|---|---|---|
| 1 | Sheet era | Establish the bar. The sheet taped by the optics, curling, biro'd. | — |
| 2 | Sheet era | Over Dave's and Sarah's shoulders at the landlord, pulling a pint one-handed, both talking. | no |
| 3 | Sheet era | His hands: the pint overfilling while he is not looking at it. | no |
| 4 | The turn | The elbow, the pint going over, ink running. No faces. | — |
| 5 | The turn | The landlord's face. Held. This is the shot the film is bought for. | — |
| 6 | Setup | Empty afternoon, chairs on tables, him alone at the bar with a phone. | — |
| 7 | Setup | Him looking up from the phone, done already. | 1 word |
| 8 | Getting them in | The chalkboard by the taps with the code on it, punters' phones up around it. | — |
| 9 | Getting them in | Dave at the bar asking; the landlord's hand pointing off, glass still in it. | no |
| 10 | The season | **The recurring bar shot.** Needs 4–6 variations: coats, a Christmas string, different shirts, the crowd thinning. Same camera every time. | no |
| 11 | The season | Dave and Sarah side on, the phone turned round between them. | no |
| 12 | Last man standing | The thinned bar, the knocked-out watching from the sides, two left. | — |
| 13 | Finish | Dave slumping; Sarah's face. | 1 word |
| 14 | End | Him wiping the bare patch of wall. Pull back, hold for the card. | no |

**Shot 10 is the risk and the day-one test.** Six versions of one room that have to look like the
same room is exactly where character and background consistency either holds or the film falls
apart. Generate it first, before anything else is attempted — if it does not hold with a trained
character, the montage structure has to change, and it is better to know that on day one than in
week three.

## 8. Product footage

Three hard cuts, full frame, 1.5–2s each with the caption band, then straight back to cartoon.
Standard ad grammar, no technical risk, and unambiguously the real product.

`../video/shots/` already holds real screenshots cropped to the app's own column — `create-*`,
`invite-*`, `standings.png`. **Re-shoot rather than re-crop** if a screen has changed.

**Do not ask the AI tool to render an app screen.** Compositing into a generated phone is only
safe if the shot is completely static, and a moving camera means motion tracking, which is where
this falls apart.

## 9. Decisions already made, so they are not re-argued

- **Sarah wins.** The loud one losing is funnier, and it keeps the cast from being a pub of blokes.
- **No prize on screen, of any kind.** See the folder README. The payoff is the bar erupting and a
  handshake.
- **It has sound**, unlike `film.html`. This is a website film — nobody scrolls past a minute of
  cartoon on a feed — so the silent-by-design rule that governs the 25s film does not apply here.
  Captions are still burned in.
- **The landlord speaks three times and never about the product.**
- **65s, landscape.** The square 1080×1080 canvas exists because Facebook autoplay does; this film
  is watched deliberately, on a page.

## 10. Voices

Regional British, unglamorous, real ages. Not RP, and not a voice actor's idea of a pub landlord.

**A phone recording of real voices beats a wrong-accent synthetic read**, and for a first cut it
is free and available today. Cast it that way unless it obviously does not work.

If synthetic voices are wanted instead, **that is a separate purchase from the video tool** — a
voice tool such as ElevenLabs, bought for the week the audio is cut, not alongside the animation
subscription. The reason §6 keeps voice out of the generation is exactly this: with dialogue cut
in locally, the voice can be recast, re-read or swapped between a real recording and a synthetic
one without re-rendering a single frame. Decide it after the picture is cut, when the film can be
watched both ways.
