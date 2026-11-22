'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Clock from './Clock';
import Feed from './Feed';
import Raiser from './Raiser';
import styles from './results.module.css';

/*
  Every section is a "page" with a number, so that the index, the fastext keys and the banners all
  point at the same thing. The colour of each is its role and does not change: yellow is the
  national game, cyan is organisers, red is the join code, green is the rules.
*/
const INDEX = [
  { no: '200', href: '#national', label: 'The national game', tone: 'yellow' },
  { no: '210', href: '#rules', label: 'How a round works', tone: 'green' },
  { no: '300', href: '#club', label: 'Run one for your club', tone: 'cyan' },
  { no: '310', href: '#raise', label: 'What it would raise', tone: 'cyan' },
  { no: '400', href: '#code', label: 'Got a code?', tone: 'red' },
  { no: '500', href: '#numbers', label: "Where we're up to", tone: 'white' },
  { no: '600', href: '#free', label: 'Free to take away', tone: 'white' },
] as const;

/*
  Real platform figures. Update them by hand; never invent them.

  ALL-TIME, not currently running. Kept all-time on purpose: a finished competition still happened,
  and a live count would read as going backwards.

  Excludes organisers 50 and 862, which are ours, and bots. Players counts each person once, including
  people added by an organiser rather than signed up themselves.

  Last counted 2026-09-16:
    SELECT COUNT(*) FROM competition WHERE organiser_id NOT IN (50,862);
    SELECT COUNT(DISTINCT organiser_id) FROM competition WHERE organiser_id NOT IN (50,862);
    SELECT COUNT(DISTINCT cu.user_id) FROM competition_user cu
      JOIN competition c ON c.id = cu.competition_id
      JOIN app_user u ON u.id = cu.user_id
     WHERE c.organiser_id NOT IN (50,862)
       AND u.email NOT LIKE 'bot_%@lms-guest.com';
*/
const TALLY = [
  { k: 'Competitions run', v: '34' },
  { k: 'Organisers', v: '30' },
  { k: 'Players', v: '360' },
];

const WEEKEND = [
  {
    when: 'Midweek',
    what: 'The round goes up',
    detail: 'Built from the real fixture list and dropped into your competition. Or put the matches in yourself.',
  },
  {
    when: 'Fri / Sat',
    what: 'Your players pick',
    detail: "One team each, on their phones. Anyone without the app tells you theirs and you enter it.",
  },
  {
    when: 'Full time',
    what: 'Results go in',
    detail: 'They arrive on their own after the final whistle, and the eliminations follow. Nobody works it out by hand.',
  },
  {
    when: 'Sun / Mon',
    what: 'You share the standings',
    detail: 'A round update is written for you: who went out, who is left. Paste it into WhatsApp or send the link.',
  },
];

const FREE_STUFF = [
  {
    no: '601',
    href: '/last-man-standing-rules.pdf',
    label: 'The rules, printed',
    blurb: 'One A4 page with blanks for your entry fee, prize and deadline.',
    download: true,
  },
  {
    no: '602',
    href: '/last-man-standing-template',
    label: 'A spreadsheet',
    blurb: 'Team dropdowns, a teams-used count, and a check that catches a duplicate pick.',
    download: false,
  },
  {
    no: '603',
    href: '/help/how-to-play',
    label: 'How it all works',
    blurb: 'The full rules: draws, lives, and running out of teams.',
    download: false,
  },
];

/*
  Kept as a link row in the footer because the home page is the only page Google reliably crawls,
  and these pages need an internal link from it to be found at all.
*/
const SITE_PAGES = [
  { href: '/app', label: 'The app' },
  { href: '/last-man-standing-for-clubs', label: 'For clubs' },
  { href: '/last-man-standing-for-pubs', label: 'For pubs' },
  { href: '/last-man-standing-at-work', label: 'At work' },
  { href: '/last-man-standing-template', label: 'Free template' },
  { href: '/help/is-it-gambling', label: 'Is it gambling?' },
];

const LEGAL = [
  { href: '/pricing', label: 'Pricing' },
  { href: '/help', label: 'Help' },
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
];

const tone = (t: string) =>
  ({ yellow: styles.yellow, green: styles.green, cyan: styles.cyan, red: styles.red, white: styles.white })[t];

/** A heading at double height. lines is the number of explicit lines, which sets the reserved height. */
function Double({
  as: Tag = 'h2',
  lines,
  chars,
  max,
  className,
  children,
}: {
  as?: 'h1' | 'h2' | 'p';
  lines: number;
  chars: number;
  max: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Tag
      className={`${styles.dh} ${className ?? ''}`}
      style={{ '--lines': lines, '--chars': chars, '--max': `${max}px` } as React.CSSProperties}
    >
      <span>{children}</span>
    </Tag>
  );
}

function Banner({
  id,
  no,
  title,
  chars,
  bg,
}: {
  id: string;
  no: string;
  title: string;
  chars: number;
  bg: 'yellow' | 'cyan' | 'red' | 'blue' | 'green';
}) {
  return (
    <div className={`${styles.banner} ${styles[`bg_${bg}`]}`}>
      <Double lines={1} chars={chars} max={52} className={styles.bannerTitle}>
        <span id={`${id}-title`}>{title}</span>
      </Double>
      <span className={styles.bannerNo} aria-hidden="true">
        P{no}
      </span>
    </div>
  );
}

function Ledger({ rows }: { rows: { k: string; v: string; t?: string }[] }) {
  return (
    <dl className={styles.dots}>
      {rows.map((r) => (
        <div key={r.k} className={styles.dotsRow}>
          <dt>{r.k}</dt>
          <dd className={r.t ? tone(r.t) : undefined}>{r.v}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function ResultsService({ fontClass }: { fontClass: string }) {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [code, setCode] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('jwt_token');
    const userData = localStorage.getItem('user');
    if (token && userData && userData !== 'undefined' && userData !== 'null') {
      try {
        JSON.parse(userData);
        setIsLoggedIn(true);
      } catch {
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('user');
      }
    }
  }, []);

  // The join page looks the code up before asking for anything, and handles signed in, signed out
  // and expired sessions itself.
  const join = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed) router.push(`/join/${encodeURIComponent(trimmed)}`);
  };

  /*
    MOCK: the national game is not built. Every account will be entered automatically, so the
    player door is "have an account": register when signed out, the dashboard when signed in. Point
    it at the game itself once it exists.
  */
  const playHref = isLoggedIn ? '/dashboard' : '/register';
  // Signed in, there is nothing national to pick in yet; say only what is true today.
  const playLabel = isLoggedIn ? "You're in — go to your dashboard" : "Play free — you're in";
  const startHref = isLoggedIn ? '/dashboard' : '/competition/create';

  return (
    <div className={`${styles.root} ${fontClass}`}>
      <header className={styles.top}>
        <div className={styles.topInner}>
          <span className={styles.pno} aria-hidden="true">
            P100
          </span>
          <Link href="/" className={styles.brand} aria-label="LMSLocal home">
            LMSLocal
          </Link>
          <nav className={styles.nav} aria-label="Site">
            <Link href="/pricing" className={styles.navLink}>
              Pricing
            </Link>
            <Link href="/help" className={`${styles.navLink} ${styles.hideSm}`}>
              Help
            </Link>
            <Link href={isLoggedIn ? '/dashboard' : '/login'} className={styles.navLink}>
              {isLoggedIn ? 'Dashboard' : 'Sign in'}
            </Link>
          </nav>
          <Clock className={styles.clock} />
        </div>
      </header>

      <main>
        {/* P100: the round happening, and both doors */}
        <section className={`${styles.screen} ${styles.hero}`} aria-labelledby="hero-title">
          <div className={styles.heroMain}>
            <Double as="h1" lines={1} chars={17} max={68} className={styles.yellow}>
              <span id="hero-title">Last Man Standing</span>
            </Double>
            <p className={styles.offer}>
              One free national game on the Premier League. Sign up and you&rsquo;re in.
            </p>
            <p className={`${styles.offer} ${styles.cyan}`}>
              Or run your own for your club, pub or workplace, and raise money.
            </p>

            <Feed />

            <div className={styles.doors}>
              <Link href={playHref} className={`${styles.btn} ${styles.btnYellow}`}>
                {playLabel}
              </Link>
              <Link href={startHref} className={`${styles.btn} ${styles.btnCyan}`}>
                Start one for your club
              </Link>
            </div>
          </div>

          <nav className={styles.index} aria-label="On this page">
            <p className={styles.indexHead}>Index</p>
            <ul>
              {INDEX.map((item) => (
                <li key={item.no}>
                  <a href={item.href} className={styles.indexLink}>
                    <span className={tone(item.tone)}>{item.no}</span>
                    <span>{item.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </section>

        {/* P200: the national game */}
        <section id="national" className={styles.page} aria-labelledby="national-title">
          <div className={styles.screen}>
            <Banner id="national" no="200" title="The national game" chars={17} bg="yellow" />
            <div className={styles.split}>
              <div>
                <p className={styles.lede}>
                  A free Last Man Standing game on the Premier League, played by everyone on
                  LMSLocal at once. There is nothing to join. If you have an account you are already
                  in it, including if you came in through your club&rsquo;s competition.
                </p>
                {/* MOCK: league, entry and prize confirmed for the game; the start date is not. */}
                <Ledger
                  rows={[
                    { k: 'League', v: 'Premier League' },
                    { k: 'Entry', v: 'Free', t: 'yellow' },
                    { k: "Who's in", v: 'Every account' },
                    { k: 'Prize', v: 'Bragging rights' },
                    { k: 'Starts', v: 'To be announced' },
                  ]}
                />
                <p className={styles.small}>
                  No entry fee and no prize money, so there is nothing to pay and nothing to win but
                  the glory of being the last one left in the country.
                </p>
                <Link href={playHref} className={`${styles.btn} ${styles.btnYellow} ${styles.mt}`}>
                  {playLabel}
                </Link>
              </div>

              <div id="rules" className={styles.rules}>
                <h3 className={styles.sub}>How a round works</h3>
                <p className={styles.rulesLead}>Pick one team before the round locks.</p>
                <Ledger
                  rows={[
                    { k: 'They win', v: 'Through', t: 'green' },
                    { k: 'They draw', v: 'Out', t: 'red' },
                    { k: 'They lose', v: 'Out', t: 'red' },
                    { k: 'No pick', v: 'Out', t: 'red' },
                  ]}
                />
                <p className={styles.small}>
                  You can&rsquo;t pick the same team twice until you&rsquo;ve used them all. Results
                  count at ninety minutes plus stoppage time.
                </p>
                <p className={`${styles.sub} ${styles.yellow}`}>Last one standing wins.</p>
              </div>
            </div>
          </div>
        </section>

        {/* P300: organisers and fundraising */}
        <section id="club" className={styles.page} aria-labelledby="club-title">
          <div className={styles.screen}>
            <Banner id="club" no="300" title="Run one for your club" chars={21} bg="cyan" />
            <div className={styles.split}>
              <div>
                <p className={styles.lede}>
                  For your club, your pub or your workplace. Set the entry fee, set the prize, and
                  keep whatever is left: for club funds, for kit, or for a charity. We never handle
                  the money and never take a cut.
                </p>

                <div id="raise" className={styles.anchor}>
                  <h3 className={`${styles.sub} ${styles.cyan}`}>What it would raise</h3>
                  <Raiser />
                </div>

                <div className={styles.price}>
                  <h3 className={`${styles.sub} ${styles.cyan}`}>What it costs you</h3>
                  <Ledger
                    rows={[
                      { k: 'First 20 player places', v: 'Free, no card', t: 'cyan' },
                      { k: '+20 places', v: '£10' },
                      { k: '+50 places', v: '£20' },
                      { k: '+120 places', v: '£40' },
                      { k: 'Our cut of your entry fees', v: 'None', t: 'cyan' },
                    ]}
                  />
                  <div className={styles.priceActs}>
                    <Link href={startHref} className={`${styles.btn} ${styles.btnCyanSolid}`}>
                      Start one — free
                    </Link>
                    <Link href="/onboarding" className={styles.textLink}>
                      Or have us set it up for you
                    </Link>
                  </div>
                </div>
              </div>

              <div>
                <h3 className={`${styles.sub} ${styles.cyan}`}>Your weekend</h3>
                <ol className={styles.listings}>
                  {WEEKEND.map((w) => (
                    <li key={w.when} className={styles.listing}>
                      <span className={styles.listingWhen}>{w.when}</span>
                      <span className={styles.listingWhat}>{w.what}</span>
                      <span className={styles.listingDetail}>{w.detail}</span>
                    </li>
                  ))}
                </ol>

                {/*
                  "Terry", not an older-sounding nickname: plenty of people who avoid the app are
                  wary of technology rather than old, and being filed under "old" is its own reason
                  to opt out. Do not put an age word back.
                */}
                <h3 className={styles.sub}>Terry doesn&rsquo;t use the app</h3>
                <p className={styles.body}>
                  Add him yourself and put his pick in each round. No email, no app, nothing for him
                  to set up, and he can win the whole thing.
                </p>

                <h3 className={styles.sub}>Who does the fixtures</h3>
                <Ledger
                  rows={[
                    { k: 'We do', v: 'Rounds arrive built', t: 'cyan' },
                    { k: 'You do', v: 'Your own teams', t: 'cyan' },
                  ]}
                />
                {/*
                  Not "you can change your mind later": update-competition leaves fixture_service
                  alone and only an admin can switch it, so the sentence has to point at us.
                */}
                <p className={styles.small}>
                  Choose when you set it up, on the leagues we cover. Ask us if you want it switched
                  later.
                </p>
              </div>
            </div>

          </div>
        </section>

        {/* P400: players holding a code */}
        <section id="code" className={styles.page} aria-labelledby="code-title">
          <div className={styles.screen}>
            <Banner id="code" no="400" title="Got a code?" chars={11} bg="red" />
            <div className={styles.split}>
              <div>
                <p className={styles.lede}>
                  Your organiser will have given you one, on a poster or in a message. Type it in and
                  you&rsquo;re on the sheet.
                </p>
                <form onSubmit={join} className={styles.codeForm}>
                  <label htmlFor="join-code" className={styles.codeLabel}>
                    Enter code
                  </label>
                  <input
                    id="join-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    className={styles.codeInput}
                  />
                  <button type="submit" className={`${styles.btn} ${styles.btnRed}`} disabled={!code.trim()}>
                    Join
                  </button>
                </form>
                <p className={styles.small}>
                  No code? Ask whoever is running it. Only they can hand one out.
                </p>
              </div>
              <div>
                <h3 className={styles.sub}>Pick on your phone</h3>
                <p className={styles.body}>
                  The app is the easiest way to make your pick each round and find out whether you
                  survived.
                </p>
                <div className={styles.apps}>
                  <a
                    href="https://apps.apple.com/gb/app/lms-local/id6755344736"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.textLink}
                  >
                    App Store
                  </a>
                  <a
                    href="https://play.google.com/store/apps/details?id=uk.co.lmslocal.lmslocal_flutter"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.textLink}
                  >
                    Google Play
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* P500: honest numbers */}
        <section id="numbers" className={styles.page} aria-labelledby="numbers-title">
          <div className={styles.screen}>
            <Banner id="numbers" no="500" title="Where we're up to" chars={17} bg="blue" />
            <div className={styles.split}>
              <div>
                <Ledger rows={TALLY} />
                <p className={styles.small}>Every competition ever run on LMSLocal, counted in September 2026.</p>
              </div>
              <div>
                {/*
                  Named causes, not a total raised: we never see the money, so a total would be
                  invented. "Among others" covers the rest without naming venues who were not asked.
                */}
                <p className={styles.body}>
                  LMSLocal is new. Some competitions have raised money for a good cause: an under-12s
                  football team and a local foodbank, among others.
                </p>
                <p className={styles.small}>
                  There are no reviews here because we haven&rsquo;t earned any yet. When an organiser
                  says something worth quoting, it goes up with their name on it.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/*
          P600: the downloads. Deliberately last. They are what somebody uses INSTEAD of us, so high
          on the page they compete with "Start one"; here they reach the reader who scrolled
          everything and did not sign up. The in-body links also carry SEO weight from the one page
          Google reliably crawls.
        */}
        <section id="free" className={styles.page} aria-labelledby="free-title">
          <div className={styles.screen}>
            <Banner id="free" no="600" title="Free to take away" chars={17} bg="green" />
            <p className={styles.lede}>
              Running one on paper instead? Take these whether you use LMSLocal or not. No sign-up.
            </p>
            <ul className={styles.freeList}>
              {FREE_STUFF.map((item) => (
                <li key={item.no}>
                  <a href={item.href} {...(item.download ? { download: true } : {})} className={styles.freeLink}>
                    <span className={styles.green}>{item.no}</span>
                    <span>{item.label}</span>
                    <span className={styles.freeBlurb}>{item.blurb}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.screen}>
          <nav className={styles.footRow} aria-label="More from LMSLocal">
            {SITE_PAGES.map((l) => (
              <Link key={l.href} href={l.href} className={styles.footLink}>
                {l.label}
              </Link>
            ))}
          </nav>
          <nav className={styles.footRow} aria-label="Legal and support">
            {LEGAL.map((l) => (
              <Link key={l.href} href={l.href} className={styles.footLink}>
                {l.label}
              </Link>
            ))}
          </nav>
          {/* Company details are a legal requirement on every page. */}
          <p className={styles.company}>
            &copy; 2026 LMSLocal. Operated by Noodev8 Ltd, company number 16222537. 3 Cumberland
            Place, Welshpool, SY21 7SB.
          </p>
        </div>
      </footer>

      {/* Fastext: the four coloured keys, fixed along the bottom of the screen */}
      <nav className={styles.fastext} aria-label="Quick links">
        {[
          { href: '#code', tone: styles.red, long: 'Got a code', short: 'Code' },
          { href: '#rules', tone: styles.green, long: 'The rules', short: 'Rules' },
          { href: '#national', tone: styles.yellow, long: 'National game', short: 'Game' },
          { href: '#club', tone: styles.cyan, long: 'Run one', short: 'Run one' },
        ].map((k) => (
          // The label names the key in full whichever word is showing, so a screen reader on a
          // phone never meets four unnamed links.
          <a key={k.href} href={k.href} className={k.tone} aria-label={k.long}>
            <span className={styles.keyLong}>{k.long}</span>
            <span className={styles.keyShort}>{k.short}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
