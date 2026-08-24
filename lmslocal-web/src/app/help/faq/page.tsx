import Link from 'next/link';
import { LABEL, EYEBROW, HEADING, PANEL } from '@/lib/design';

export const metadata = {
  title: 'Frequently Asked Questions - LMSLocal Help',
  description:
    'Answers to common questions about Last Man Standing: what a draw does to your pick, when picks lock, lives, resets, credits, and running a competition for your pub, workplace or club.',
  keywords:
    'last man standing FAQ, last man standing rules, does a draw count, when do picks lock, competition rules, football sweepstake help',
  alternates: { canonical: 'https://lmslocal.co.uk/help/faq' },
  openGraph: {
    title: 'Last Man Standing: Frequently Asked Questions',
    description:
      'What happens on a draw, when picks lock, how lives work, what a reset costs — the questions organisers and players actually ask.',
    type: 'article'
  }
};

/*
  The FAQ is data, not markup.

  Two reasons. Google's FAQPage rich result needs every question and answer a second time as
  JSON-LD, and a hand-maintained copy of a page's own text drifts the moment somebody edits one
  and not the other — at which point the structured data is a lie we are actively publishing.
  Here the page and the schema are rendered from the same array, so they cannot disagree.

  Second, answers are plain strings rather than JSX so they can be flattened to text for the
  schema. That also means writing an apostrophe as an apostrophe: React escapes on render, so
  none of the &apos; noise the hand-written version was carrying.
*/

type Block = { p: string } | { ul: string[] } | { ol: string[] };

type Faq = {
  q: string;
  a: Block[];
};

type Section = {
  id: string;
  title: string;
  faqs: Faq[];
};

const SECTIONS: Section[] = [
  {
    id: 'general',
    title: 'The basics',
    faqs: [
      {
        q: 'What is Last Man Standing?',
        a: [
          {
            p: 'An elimination competition. Each round you pick one team you think will win. If they win, you go through to the next round. If they lose or draw, you are out — or you lose a life, if your competition gives you one. Players drop away week by week until somebody is the last one standing.'
          }
        ]
      },
      {
        q: 'Does a draw count as a win?',
        a: [
          {
            p: 'No. Your team has to win. A draw is treated exactly the same as a defeat: it costs you a life, or puts you out if you have none left. This catches more people out than anything else in the game, so it is worth saying plainly before you pick a team you fancy for a point.'
          }
        ]
      },
      {
        q: 'Is extra time or penalties included in the result?',
        a: [
          {
            p: 'No. Results are judged on regulation time only — the ninety minutes plus stoppage time. If a cup tie is level at full time and your team goes on to win in extra time or on penalties, the pick still counts as a draw and you still lose a life.'
          },
          {
            p: 'It is the standard Last Man Standing convention and it removes any argument about which scoreline counted.'
          }
        ]
      },
      {
        q: 'How much does it cost?',
        a: [
          {
            p: 'Players: nothing. Joining is free. Your organiser may run their own entry fee or kitty, which is between you and them and has nothing to do with us.'
          },
          {
            p: 'Organisers: your first 20 places are free and yours for good, no card needed. They are shared across everything you run, not 20 per competition. Every player past that uses a credit, and credits come in packs starting at £10 for 20 more places.'
          }
        ]
      },
      {
        q: 'Can I play on mobile?',
        a: [
          {
            p: 'Yes. It works in any browser on a phone, tablet or computer — there is nothing to install, and most players do the whole thing on their phone.'
          }
        ]
      }
    ]
  },
  {
    id: 'playing',
    title: 'Playing',
    faqs: [
      {
        q: 'How do I join a competition?',
        a: [
          {
            p: 'Your organiser gives you an invite code. Enter it in the join box on the LMSLocal home page, then sign in or create an account. If they sent you a link instead, the code is already in it — just follow the link.'
          },
          {
            p: 'You can only join before round 1 locks. After that the competition is closed and you will have to wait for the next one.'
          }
        ]
      },
      {
        q: 'Can I change my pick?',
        a: [
          {
            p: 'Yes — right up until the round locks. You can switch to a different team as often as you like, or clear your pick and come back to it later. Once the deadline passes, whatever is showing is your pick and it can no longer be changed.'
          }
        ]
      },
      {
        q: 'When do picks lock?',
        a: [
          {
            p: 'At the deadline your organiser sets for that round. There is no automatic buffer before kick-off, so do not assume it is an hour before the first match — it might be, or it might not.'
          },
          { p: 'The deadline is shown on your dashboard and again on the pick screen. Check it there rather than guessing.' }
        ]
      },
      {
        q: 'What if I forget to pick?',
        a: [
          { p: 'Missing the deadline counts the same as a losing pick. You lose a life, or you are eliminated if you had none left.' }
        ]
      },
      {
        q: 'Can I use the same team twice?',
        a: [
          {
            p: 'Usually not — most competitions run the "no team twice" rule, so once you have used a team they are gone from your list. Your organiser chooses this when they set the competition up, and it cannot be changed once round 1 has started.'
          }
        ]
      },
      {
        q: 'What happens when I run out of teams?',
        a: [
          {
            p: 'Every team comes back. Once you have used all of them, your list resets and the whole roster is available to you again from the next round.'
          },
          {
            p: 'It happens per player rather than per competition, so somebody who joined later still has their own teams to work through. Worth planning for: the last few rounds before a reset are the ones where people get stuck with nobody good left.'
          }
        ]
      },
      {
        q: 'Can I join multiple competitions?',
        a: [{ p: 'Yes, as many as you like on one account. Your picks and your used teams are tracked separately in each one.' }]
      },
      {
        q: 'How do I know if I am eliminated?',
        a: [
          {
            p: 'Your dashboard shows your status and how many lives you have left. If you are out, it says so and tells you which round you went out in.'
          }
        ]
      },
      {
        q: 'Can other players see my picks?',
        a: [
          {
            p: 'Not before the deadline. Until the round locks, your pick is yours alone — nobody else can see it, including players who have already picked.'
          },
          {
            p: 'Once the round locks, everybody’s picks become visible on the standings. That is the point at which the second-guessing starts.'
          }
        ]
      },
      {
        q: 'What happens if my team’s match is postponed?',
        a: [
          {
            p: 'That is your organiser’s call — there is no automatic "void" outcome. A fixture with no result entered simply stays unresulted, and the round does not finish until it has one.'
          },
          {
            p: 'Some organisers wait for the rearranged match, others decide the pick counts as a win. Ask yours what they do before it comes up.'
          }
        ]
      },
      {
        q: 'Can eliminated players rejoin?',
        a: [
          {
            p: 'Not under your own steam — elimination is final from the player’s side. Your organiser can put somebody back in by hand if they judge it fair, but that is entirely their decision, so ask rather than expect.'
          },
          { p: 'A competition reset is the other route: it starts the whole thing again with everybody back in.' }
        ]
      },
      {
        q: 'How are ties handled?',
        a: [
          {
            p: 'If the last remaining players are all eliminated in the same round, nobody is left standing and they share the win. How that translates into a prize is for your organiser to decide — commonly the pot is split, or the competition is reset and run again.'
          }
        ]
      },
      {
        q: 'How long does a competition last?',
        a: [
          {
            p: 'Until somebody wins, which is a matter of luck rather than a fixed length. Small competitions can be over in five or six rounds. A big one can run most of a season, especially with lives in play.'
          }
        ]
      }
    ]
  },
  {
    id: 'organising',
    title: 'Running a competition',
    faqs: [
      {
        q: 'How many players can join?',
        a: [
          {
            p: 'As many as you like — there is no cap on the size of a competition. Your first 20 places are free across everything you run, and each player after that uses a credit, so a big competition is a question of credits rather than a limit.'
          }
        ]
      },
      {
        q: 'How many competitions can I run?',
        a: [
          {
            p: 'As many as you want, all from one account. Remember the 20 free places are shared across them rather than granted to each.'
          }
        ]
      },
      {
        q: 'Can I charge an entry fee, and is that gambling?',
        a: [
          {
            p: 'Plenty of organisers charge one, and most fundraisers sit well inside the rules — but it is a real question rather than a formality, and the answer depends on who is playing and where the money ends up. A competition with no entry fee is not gambling at all, whatever the prize.'
          },
          {
            p: 'The Is it gambling? page in this help centre maps it out in plain English and links to the Gambling Commission pages it comes from. We are not lawyers, so treat it as a starting point rather than a ruling.'
          }
        ]
      },
      {
        q: 'Does LMSLocal take the entry money or pay the prizes?',
        a: [
          {
            p: 'No. We never take entry fees, hold stakes or pay prizes, and that is deliberate — the money is between you and your players, collected and handed out however you like. The only thing you ever pay us for is player places.'
          }
        ]
      },
      {
        q: 'How do I get people to join?',
        a: [
          {
            p: 'Getting players in is the hardest part of running a competition, and it is the part we can actually help with. Every competition has a Promote page with the work already done:'
          },
          {
            ul: [
              'Ready-made WhatsApp messages you can edit and copy',
              'An image to post on Facebook or Instagram',
              'A QR code to print and put up behind the bar',
              'Your join link, ready to paste anywhere'
            ]
          },
          {
            p: 'Most organisers find one good WhatsApp message to the right group does more than everything else put together.'
          }
        ]
      },
      {
        q: 'Who supplies the fixtures and results?',
        a: [
          {
            p: 'Either us or you. Where we cover the league your competition is using, you are offered the choice as you create it. Where we do not cover it, you run the fixtures yourself.'
          },
          {
            p: 'Do it for me — we add each round’s fixtures and enter the results as they come in. You pick a start date up front, round 1 is there from the moment the competition exists, and your job is just to get people to join.'
          },
          {
            p: 'I’ll do my own — you enter the matches and the results yourself each round, and you set the lock time. More work, but complete control over what counts and when.'
          },
          {
            p: 'It is not something you can change yourself once the competition exists, but it is not set in stone either: ask us and we will switch a competition from one to the other.'
          }
        ]
      },
      {
        q: 'Do I have to wait for every match to finish before entering results?',
        a: [
          {
            p: 'No — if you run your own fixtures, put results in as they come in. Enter one and process the round, and anyone whose team has lost is out there and then: they find out on Saturday evening instead of Sunday night, and the players still in can see where they stand.'
          },
          {
            p: 'The rest of the round carries on as normal, and you keep adding results as the matches finish. If we supply your fixtures there is nothing to do — we enter them for you as the results come in.'
          }
        ]
      },
      {
        q: 'What if I enter the wrong result?',
        a: [
          {
            p: 'While you are still entering them, tap a result again to clear it and put a different one in. Nothing is committed until you submit the round.'
          },
          {
            p: 'Once you submit, the results are final and there is no way to change them in the app. Get in touch with us and we will see what can be done. Be aware that unwinding a submitted round is not a simple edit — it has already decided who won, who lost a life and who went out, and every one of those has to be put back by hand — so it is worth checking the results carefully before you submit.'
          }
        ]
      },
      {
        q: 'Can I change the rules after starting?',
        a: [
          { p: 'Some of them:' },
          {
            ul: [
              'Name and description: yes, whenever you like',
              'Lives and the no-team-twice rule: no, these lock once the first round starts'
            ]
          },
          {
            p: 'Changing the game rules underneath people who are already playing would not be fair on them, which is why those two set hard.'
          }
        ]
      },
      {
        q: 'What does resetting a competition actually do?',
        a: [
          {
            p: 'It puts the competition back to the start. Every round, pick and result is cleared and everyone still in it is restored to full lives, ready for a new set of fixtures. It does not finish the current game or file the stats away — the previous run is simply gone.'
          },
          {
            p: 'The point of it is that you do not have to invite everybody again. The invite code stays the same and your players keep their place without lifting a finger. If one of them does not fancy another go, remove that single player rather than starting from scratch.'
          },
          {
            p: 'Your first 20 places are still free. Beyond that, bringing a player back uses a place, the same as if they were joining for the first time — the last run’s places were spent on the last run. You are shown the exact number before you confirm, with the option to back out and tidy up your player list first.'
          }
        ]
      },
      {
        q: 'Can I bring an eliminated player back in?',
        a: [
          {
            p: 'Yes — a player’s in/out status is yours to set, so you can move somebody from eliminated back to active whenever you think it is the fair thing to do.'
          },
          {
            p: 'Treat it as an override rather than part of the game. Nothing recalculates around it, so a player brought back mid-competition can look odd in the standings and in their own history. Use it sparingly and tell your other players you have done it. If you want a genuinely clean slate for everyone, reset the competition instead.'
          }
        ]
      },
      {
        q: 'If I remove a player, do I get their credit back?',
        a: [
          {
            p: 'Only if you remove them before the competition has started. Once it is underway, removing a player frees up their place but does not refund a credit that has been spent.'
          }
        ]
      },
      {
        q: 'What happens if a player tries to join when I am full?',
        a: [
          {
            p: 'They see a message saying the competition is full and to get in touch with you. You get a notice on your dashboard shortly afterwards, so you can buy more places or tell them where they stand.'
          }
        ]
      },
      {
        q: 'What is the "Set Pick" option against a player’s name for?',
        a: [
          {
            p: 'An optional override for making or correcting a pick on somebody’s behalf — the player who texts you their team because they will be on a plane at lock time, or one who has picked the wrong side of a fixture by mistake. You do not need to use it to confirm picks players have made themselves.'
          }
        ]
      },
      {
        q: 'How do I handle disputes?',
        a: [
          { p: 'You have the final say, and the tools to back it up:' },
          {
            ul: [
              'Set or change any player’s pick before the round locks',
              'Adjust a player’s lives, or their in/out status',
              'Add or remove players at any point',
              'Reset the whole competition and start again'
            ]
          },
          {
            p: 'The platform runs the competition; it does not referee it. Where a call is a judgement rather than a fact — a postponed match, a player who says they picked and did not — the decision is yours, and being seen to make it consistently matters more than which way you go.'
          }
        ]
      }
    ]
  },
  {
    id: 'account',
    title: 'Account, privacy and problems',
    faqs: [
      {
        q: 'I cannot log in — what should I try?',
        a: [
          {
            ol: [
              'Check you are using the email address you signed up with',
              'Use the forgot password link to set a new one',
              'Try a different browser, or clear this one’s cache',
              'Get in touch if none of that works'
            ]
          }
        ]
      },
      {
        q: 'Can I change the name I play under?',
        a: [
          {
            p: 'Yes, and it does not have to be the same everywhere. Set your name in Profile, and under it a separate name for each competition you are in — the name the pub knows you by is not always the one the office does.'
          }
        ]
      },
      {
        q: 'Can I give a competition a name of my own?',
        a: [
          {
            p: 'Yes. Tap the pencil beside a competition on your dashboard and call it whatever tells you which one it is.'
          },
          {
            p: 'Only you see that name. Everyone else still sees the one the organiser chose, and the competition itself is not renamed — organisers who want to change the real name do it in the competition settings.'
          }
        ]
      },
      {
        q: 'What timezone are the deadlines in?',
        a: [
          {
            p: 'Yours. Times are converted to whatever timezone your device is set to, so the deadline you see is the deadline where you are.'
          }
        ]
      },
      {
        q: 'Is my data safe?',
        a: [
          {
            p: 'Passwords are hashed, connections are encrypted, and we do not sell or share personal data. We ask for an email address and a display name and no more, because we would rather not hold anything we do not need.'
          }
        ]
      },
      {
        q: 'Can I delete my account?',
        a: [
          {
            p: 'Yes, from your profile settings. It takes you out of every competition you have joined and deletes your picks and history along with the account.'
          },
          { p: 'If you organise competitions of your own, delete those first — the account cannot be removed while it still owns live ones.' }
        ]
      }
    ]
  }
];

/* Anchors, so an answer can be linked to directly and search results can deep-link into it. */
const slug = (q: string) =>
  q
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);

/* Flatten an answer to the plain text the FAQPage schema wants. */
const asText = (blocks: Block[]) =>
  blocks.map((b) => ('p' in b ? b.p : 'ul' in b ? b.ul.join('. ') : b.ol.join('. '))).join(' ');

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: SECTIONS.flatMap((s) =>
    s.faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: asText(f.a) }
    }))
  )
};

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        if ('p' in b) {
          return (
            <p key={i} className={`text-[17px] leading-relaxed text-ink${i > 0 ? ' mt-3' : ''}`}>
              {b.p}
            </p>
          );
        }
        if ('ul' in b) {
          return (
            <ul key={i} className="mt-3 space-y-1.5">
              {b.ul.map((item, j) => (
                <li key={j} className="flex gap-3 text-[17px] leading-relaxed text-ink">
                  <span aria-hidden="true" className="text-ink-fade">
                    &mdash;
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <ol key={i} className="mt-3 space-y-1.5">
            {b.ol.map((item, j) => (
              <li key={j} className="flex gap-3 text-[17px] leading-relaxed text-ink">
                <span className={`${LABEL} flex-none translate-y-[5px] text-ink-fade`}>{j + 1}</span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        );
      })}
    </>
  );
}

export default function FAQPage() {
  return (
    <div className="max-w-3xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <h1 className={`${HEADING} text-5xl sm:text-6xl`}>Frequently asked questions</h1>
      <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink">
        The questions players and organisers actually ask &mdash; how a draw is treated, when picks
        lock, what happens when you run out of teams, and what running a competition costs.
      </p>

      {/* Jump links. The page is long and most people arrive wanting one answer. */}
      <div className="mt-7 flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className={`${LABEL} rounded-sm border border-ink/30 px-3 py-2 text-ink-fade transition-colors hover:border-ink hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink`}
          >
            {s.title}
          </a>
        ))}
      </div>

      {SECTIONS.map((section) => (
        <section key={section.id} id={section.id} className="mt-14 scroll-mt-8 border-t border-ink/30 pt-10">
          <p className={`${EYEBROW} text-overprint`}>{section.title}</p>

          {/*
            One hairline between answers rather than a card around each. A page of forty stacked
            panels reads as a list of boxes; the coupon reads as a ruled sheet.
          */}
          <dl className="mt-6 divide-y divide-ink/30 border-y border-ink/30">
            {section.faqs.map((faq) => (
              <div key={faq.q} id={slug(faq.q)} className="scroll-mt-8 py-7 first:pt-6 last:pb-6">
                <dt className={`${HEADING} text-2xl tracking-[0.02em]`}>{faq.q}</dt>
                <dd className="mt-3">
                  <Blocks blocks={faq.a} />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      {/*
        Where to go next. The help layout already ends every page with the contact panel, so
        repeating it here just put the same two buttons on screen twice.
      */}
      <section className="mt-14 border-t border-ink/30 pt-10">
        <p className={`${EYEBROW} text-ink-fade`}>Not what you were after?</p>
        <ul className={`${PANEL} mt-5 divide-y divide-ink/30`}>
          {[
            { href: '/help/how-to-play', label: 'The full rules of Last Man Standing' },
            { href: '/help/getting-started/organizers', label: 'Setting up your first competition' },
            { href: '/help/getting-started/players', label: 'Joining and playing' },
            { href: '/pricing', label: 'What credits cost' }
          ].map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="flex items-baseline gap-3 px-5 py-4 text-[17px] text-ink transition-colors hover:bg-stock focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
              >
                <span aria-hidden="true" className="text-ink-fade">
                  &rarr;
                </span>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
