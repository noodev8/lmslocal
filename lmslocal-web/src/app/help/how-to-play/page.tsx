export const metadata = {
  title: 'How to Play Last Man Standing - LMSLocal Help',
  description: 'Learn how to play Last Man Standing competitions. Pick one team each week to win - if they lose or draw, you\'re out. Simple rules, exciting competition.',
  keywords: 'last man standing rules, how to play last man standing, does a draw count, football elimination game, premier league last man standing',
  alternates: { canonical: 'https://lmslocal.co.uk/help/how-to-play' },
  openGraph: {
    title: 'How to Play Last Man Standing',
    description: 'Pick one team each week to win. If they lose or draw, you\'re out. Learn the complete rules.',
    type: 'article',
  }
};

/*
  The three steps below are shown on the page and handed to Google as HowTo structured data.
  One array feeds both, for the same reason the FAQ works that way - a second hand-written copy
  of the steps is a copy that will quietly stop matching the page.
*/
const STEPS = [
  {
    name: 'Join a competition',
    text: 'Get the invite code from whoever is running the competition, enter it on the join page, and you are in. Joining closes when the first round locks.'
  },
  {
    name: 'Pick one team to win',
    text: 'Each round, choose a single team you think will win their match. You can change your mind as often as you like until the round locks. You cannot pick the same team twice until you have used them all, at which point they all come back.'
  },
  {
    name: 'Win and go through',
    text: 'If your team wins in regulation time you go through to the next round. A draw or a defeat costs you a life, or puts you out if you have none left. Keep going until you are the last player standing.'
  }
];

const howToSchema = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'How to play Last Man Standing',
  description:
    'Last Man Standing is a football elimination competition. Pick one team to win each round: if they win you go through, if they lose or draw you are out.',
  totalTime: 'PT5M',
  step: STEPS.map((s, i) => ({
    '@type': 'HowToStep',
    position: i + 1,
    name: s.name,
    text: s.text
  }))
};

export default function HowToPlayPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }} />
      {/* Hero Section */}
      <div className="border border-ink/30 bg-stock-lit p-8 mb-8">
        <h1 className="font-display text-5xl font-semibold uppercase leading-[0.9] text-ink sm:text-6xl mb-6">
          How to Play Last Man Standing
        </h1>

        <div className="text-lg text-ink mb-6 space-y-4">
          <p>
            <strong>Simple concept:</strong> Pick one team to WIN each round. If your team WINS, you advance.
            If they LOSE or DRAW, you&apos;re eliminated.
          </p>

          <div className="bg-stock-lit border border-ink/30 rounded p-4">
            <p className="font-semibold">🚫 Key rule: you cannot pick the same team twice.</p>
            <p className="text-sm mt-2 text-ink-fade">Once you have used every team, they all come back and you start the list again.</p>
          </div>

          <div className="bg-stock-lit border border-ink/30 rounded p-4">
            <p className="font-semibold">⏱️ Regulation time only.</p>
            <p className="text-sm mt-2 text-ink-fade">Results are settled on the ninety minutes plus stoppage time. A cup tie your team wins in extra time or on penalties still counts as a draw, and a draw goes against you.</p>
          </div>

          <p>
            <strong>LMS Local twist:</strong> Organisers can give every player a life, so one bad
            week does not end their competition.
          </p>
        </div>
      </div>

      {/* Core Rules */}
      <div className="bg-stock-lit rounded-none p-8 mb-8 border">
        <h2 className="font-display text-4xl font-semibold uppercase leading-[0.9] text-ink mb-6">Core Rules</h2>

        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="mt-8 font-display text-2xl uppercase tracking-[0.03em] text-ink mb-4">✅ How to Win</h3>
            <ul className="space-y-2 text-[17px] leading-relaxed text-ink">
              <li>• Your selected team must <strong>WIN</strong> their match</li>
            </ul>
          </div>

          <div>
            <h3 className="mt-8 font-display text-2xl uppercase tracking-[0.03em] text-ink mb-4">❌ How to Go Out</h3>
            <ul className="space-y-2 text-[17px] leading-relaxed text-ink">
              <li>• Your team <strong>LOSES</strong> their match</li>
              <li>• Your team <strong>DRAWS</strong> their match</li>
              <li>• You miss the pick deadline</li>
              <li className="pt-2 text-ink-fade">Any of these costs a life. With no lives left, it puts you out.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Lives System */}
      <div className="bg-stock-lit rounded-none p-8 mb-8 border">
        <h2 className="font-display text-4xl font-semibold uppercase leading-[0.9] text-ink mb-6">Lives System</h2>
        <p className="text-[17px] leading-relaxed text-ink mb-6">Your organiser sets how many lives each player gets at the start:</p>

        <div className="grid grid-cols-2 gap-4">
          <div className="border border-ink/30 bg-stock-lit p-6 text-center">
            <div className="text-2xl mb-2">💀</div>
            <h3 className="font-semibold text-ink mb-2">0 Lives</h3>
            <p className="text-[15px] text-ink-fade">Knockout format</p>
          </div>

          <div className="border border-ink/30 bg-stock-lit p-6 text-center">
            <div className="text-2xl mb-2">❤️</div>
            <h3 className="font-semibold text-ink mb-2">1 Life</h3>
            <p className="text-[15px] text-ink-fade">One second chance</p>
          </div>
        </div>
      </div>

      {/* Strategy Tips */}
      <div className="bg-stock-lit rounded-none p-8 mb-8 border">
        <h2 className="font-display text-4xl font-semibold uppercase leading-[0.9] text-ink mb-6">💡 Strategy Tips</h2>

        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="font-display text-xl uppercase tracking-[0.03em] text-ink mb-4">Smart Team Management</h3>
            <ul className="space-y-2 text-[17px] leading-relaxed text-ink">
              <li>• Don&apos;t use Manchester City or Arsenal in easy early rounds</li>
              <li>• Save the strongest teams for difficult fixtures later</li>
              <li>• Look ahead at upcoming fixtures before picking</li>
              <li>• Consider which teams others might avoid</li>
            </ul>
          </div>

          <div>
            <h3 className="font-display text-xl uppercase tracking-[0.03em] text-ink mb-4">Tactical Considerations</h3>
            <ul className="space-y-2 text-[17px] leading-relaxed text-ink">
              <li>• Home advantage matters - check venue</li>
              <li>• Consider recent team form and injuries</li>
              <li>• Derby matches can be unpredictable</li>
              <li>• Track what teams other players have used</li>
            </ul>
          </div>
        </div>
      </div>

      {/* How to Win */}
      <div className="bg-stock-lit rounded-none p-8 mb-8 border">
        <h2 className="font-display text-4xl font-semibold uppercase leading-[0.9] text-ink mb-6">🏆 How to Win the Competition</h2>

        <p className="text-[17px] leading-relaxed text-ink mb-6">Be the <strong>last player standing</strong>!</p>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="border border-ink/30 bg-stock-lit p-4 text-center">
            <h3 className="font-semibold text-ink mb-2">Winner</h3>
            <p className="text-[15px] text-ink-fade">Only one player remains</p>
          </div>

          <div className="border border-ink/30 bg-stock-lit p-4 text-center">
            <h3 className="font-semibold text-ink mb-2">Draw - No winner</h3>
            <p className="text-[15px] text-ink-fade">Multiple players eliminated in same round</p>
          </div>
        </div>
      </div>

      {/* Getting Started */}
      <div className="border border-ink/30 bg-stock-lit p-8 mb-8">
        <h2 className="text-2xl font-bold text-ink mb-6 text-center">🚀 Ready to Play?</h2>

        <div className="grid md:grid-cols-3 gap-6">
          {STEPS.map((step, i) => (
            <div key={step.name} className="bg-stock-lit rounded-none p-6 border">
              <div className="mb-4 flex h-8 w-8 items-center justify-center bg-overprint font-display text-stock-lit">{i + 1}</div>
              <h3 className="font-semibold text-ink mb-2">{step.name}</h3>
              <p className="text-[15px] text-ink-fade">{step.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Final CTA */}
      <div className="bg-ink text-stock-lit rounded-none p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Important to Remember</h2>
        <p className="text-lg mb-4">
          You can change your pick at any time <strong className="text-stock-lit">until lock time</strong>. Choose wisely!
        </p>
        <p className="text-[17px] leading-relaxed text-stock/85">
          Good luck, and may the best strategist win! 🏆
        </p>
      </div>
    </div>
  );
}