export const metadata = {
  title: 'Frequently Asked Questions - LMSLocal Help',
  description: 'Get answers to common questions about Last Man Standing competitions, organizing events, player rules, and technical support.',
  keywords: 'last man standing FAQ, help, questions, competition rules, technical support',
  openGraph: {
    title: 'Frequently Asked Questions',
    description: 'Get answers to common questions about Last Man Standing competitions and LMSLocal platform.',
    type: 'article',
  }
};

export default function FAQPage() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="border border-ink/30 bg-stock-lit p-8 mb-8">
        <h1 className="text-4xl font-bold text-ink mb-4">
          Frequently Asked Questions
        </h1>
        <p className="text-lg text-ink">
          Find quick answers to common questions about Last Man Standing competitions,
          organizing events, and using the LMSLocal platform.
        </p>
      </div>

      {/* General Questions */}
      <div className="bg-stock-lit rounded-none p-8 mb-8 border">
        <h2 className="font-display text-4xl font-semibold uppercase leading-[0.9] text-ink mb-6 flex items-center">
          <span className="text-2xl mr-3">❓</span>
          General Questions
        </h2>

        <div className="space-y-6">
          <div>
            <h3 className="font-display text-xl uppercase tracking-[0.03em] text-ink mb-2">Q: What is Last Man Standing?</h3>
            <p className="text-[17px] leading-relaxed text-ink">A: Last Man Standing (LMS) is an elimination-style competition where players pick one winning team each round. Wrong picks may lead to elimination, and the last player(s) remaining win.</p>
          </div>

          <div>
            <h3 className="font-display text-xl uppercase tracking-[0.03em] text-ink mb-2">Q: How much does it cost?</h3>
            <div className="text-[17px] leading-relaxed text-ink">
              <p>A: For players: Free to join competitions. Your organiser may charge their own entry fees.</p>
              <p className="mt-2">For organisers: Your first 20 player slots are free, shared across all of your competitions (not 20 per competition). Anyone beyond that uses a paid credit.</p>
            </div>
          </div>

          <div>
            <h3 className="font-display text-xl uppercase tracking-[0.03em] text-ink mb-2">Q: Can I play on mobile?</h3>
            <p className="text-[17px] leading-relaxed text-ink">A: Yes! LMSLocal works on all devices - phones, tablets, and computers.</p>
          </div>
        </div>
      </div>

      {/* For Organisers */}
      <div className="bg-stock-lit rounded-none p-8 mb-8 border">
        <h2 className="font-display text-4xl font-semibold uppercase leading-[0.9] text-ink mb-6 flex items-center">
          <span className="text-2xl mr-3">👥</span>
          For Organisers
        </h2>

        <div className="space-y-6">
          <div>
            <h3 className="font-display text-xl uppercase tracking-[0.03em] text-ink mb-2">Q: How many competitions can I run?</h3>
            <p className="text-[17px] leading-relaxed text-ink">A: Unlimited! You can manage multiple competitions from a single account.</p>
          </div>

          <div>
            <h3 className="font-display text-xl uppercase tracking-[0.03em] text-ink mb-2">Q: What happens if a player tries to join once I&apos;m full?</h3>
            <p className="text-[17px] leading-relaxed text-ink">A: They&apos;ll see a message saying the competition is full and to contact you. You&apos;ll also get a notification on your dashboard shortly after they try.</p>
          </div>

          <div>
            <h3 className="font-display text-xl uppercase tracking-[0.03em] text-ink mb-2">Q: If I remove a player, do I get their credit back?</h3>
            <p className="text-[17px] leading-relaxed text-ink">A: Only if you remove them before the competition has started. Once it&apos;s underway, removing a player frees up the slot but doesn&apos;t refund a paid credit.</p>
          </div>

          <div>
            <h3 className="font-display text-xl uppercase tracking-[0.03em] text-ink mb-2">Q: If there&apos;s a rollover and everyone goes back in, do I need to buy credits again?</h3>
            <p className="text-[17px] leading-relaxed text-ink">A: Not if you&apos;re at or under your free 20. If your competition has grown past 20 players, restoring everyone on reset will charge for the overage — this is shown clearly before you confirm the reset, with the option to back out.</p>
          </div>

          <div>
            <h3 className="font-display text-xl uppercase tracking-[0.03em] text-ink mb-2">Q: What&apos;s the &quot;Set Pick&quot; option against a player&apos;s name for?</h3>
            <p className="text-[17px] leading-relaxed text-ink">A: It&apos;s an optional override for setting or correcting a pick on a player&apos;s behalf — for example if they can&apos;t pick themselves in time. You don&apos;t need to use it to confirm every player&apos;s pick.</p>
          </div>

          <div>
            <h3 className="font-display text-xl uppercase tracking-[0.03em] text-ink mb-2">Q: Can I change rules after starting?</h3>
            <div className="text-[17px] leading-relaxed text-ink">
              <p>A: It depends on what you want to change:</p>
              <ul className="mt-2 space-y-1 ml-4">
                <li>• Competition name and description: Yes, anytime</li>
                <li>• Lives and No Team Twice rule: No, locked after first round starts</li>
              </ul>
            </div>
          </div>

          <div>
            <h3 className="font-display text-xl uppercase tracking-[0.03em] text-ink mb-2">Q: How do I handle disputes?</h3>
            <div className="text-[17px] leading-relaxed text-ink">
              <p>A: You have full control to:</p>
              <ul className="mt-2 space-y-1 ml-4">
                <li>• Override any player&apos;s pick</li>
                <li>• Adjust match results</li>
                <li>• Add or remove players</li>
                <li>• Make final decisions on edge cases</li>
              </ul>
            </div>
          </div>

          <div>
            <h3 className="font-display text-xl uppercase tracking-[0.03em] text-ink mb-2">Q: What if I enter wrong results?</h3>
            <p className="text-[17px] leading-relaxed text-ink">A: You can edit match results at any time. The system will automatically recalculate eliminations.</p>
          </div>
        </div>
      </div>

      {/* For Players */}
      <div className="bg-stock-lit rounded-none p-8 mb-8 border">
        <h2 className="font-display text-4xl font-semibold uppercase leading-[0.9] text-ink mb-6 flex items-center">
          <span className="text-2xl mr-3">⚽</span>
          For Players
        </h2>

        <div className="space-y-6">
          <div>
            <h3 className="font-display text-xl uppercase tracking-[0.03em] text-ink mb-2">Q: Can I change my pick?</h3>
            <p className="text-[17px] leading-relaxed text-ink">A: No, picks are final once submitted. Double-check before confirming!</p>
          </div>

          <div>
            <h3 className="font-display text-xl uppercase tracking-[0.03em] text-ink mb-2">Q: What if I forget to pick?</h3>
            <p className="text-[17px] leading-relaxed text-ink">A: Missing a pick counts as a wrong pick. You&apos;ll lose a life (or be eliminated in knockout format).</p>
          </div>

          <div>
            <h3 className="font-display text-xl uppercase tracking-[0.03em] text-ink mb-2">Q: Can I join multiple competitions?</h3>
            <p className="text-[17px] leading-relaxed text-ink">A: Yes! You can join as many competitions as you want with the same account.</p>
          </div>

          <div>
            <h3 className="font-display text-xl uppercase tracking-[0.03em] text-ink mb-2">Q: How do I know if I&apos;m eliminated?</h3>
            <p className="text-[17px] leading-relaxed text-ink">A: Check your competition dashboard - your status will show as &quot;Eliminated&quot; and you&apos;ll see which round you went out.</p>
          </div>

          <div>
            <h3 className="font-display text-xl uppercase tracking-[0.03em] text-ink mb-2">Q: What happens if my team&apos;s match is postponed?</h3>
            <p className="text-[17px] leading-relaxed text-ink">A: Usually, postponed matches are void (no win or loss), but check with your organiser for their specific rules.</p>
          </div>
        </div>
      </div>

      {/* Technical Questions */}
      <div className="bg-stock-lit rounded-none p-8 mb-8 border">
        <h2 className="font-display text-4xl font-semibold uppercase leading-[0.9] text-ink mb-6 flex items-center">
          <span className="text-2xl mr-3">🔧</span>
          Technical Questions
        </h2>

        <div className="space-y-6">
          <div>
            <h3 className="font-display text-xl uppercase tracking-[0.03em] text-ink mb-2">Q: I can&apos;t log in - help!</h3>
            <div className="text-[17px] leading-relaxed text-ink">
              <p>A: Try these steps:</p>
              <ol className="mt-2 space-y-1 ml-4 list-decimal">
                <li>Check you&apos;re using the correct email</li>
                <li>Try the &quot;Forgot Password&quot; option</li>
                <li>Clear your browser cache</li>
                <li>Contact support if issues persist</li>
              </ol>
            </div>
          </div>

          <div>
            <h3 className="font-display text-xl uppercase tracking-[0.03em] text-ink mb-2">Q: How do I join a competition?</h3>
            <div className="text-[17px] leading-relaxed text-ink">
              <p>A: Enter the invite code from your organiser</p>
            </div>
          </div>

          <div>
            <h3 className="font-display text-xl uppercase tracking-[0.03em] text-ink mb-2">Q: Can I use the same team twice?</h3>
            <p className="text-[17px] leading-relaxed text-ink">A: In most competitions, no. The &quot;No Team Twice&quot; rule prevents reusing teams. Check your competition settings.</p>
          </div>

          <div>
            <h3 className="font-display text-xl uppercase tracking-[0.03em] text-ink mb-2">Q: What timezone are deadlines in?</h3>
            <p className="text-[17px] leading-relaxed text-ink">A: All times are shown in your local timezone automatically.</p>
          </div>
        </div>
      </div>

      {/* Competition Management */}
      <div className="bg-stock-lit rounded-none p-8 mb-8 border">
        <h2 className="font-display text-4xl font-semibold uppercase leading-[0.9] text-ink mb-6 flex items-center">
          <span className="text-2xl mr-3">⚙️</span>
          Competition Management
        </h2>

        <div className="space-y-6">
          <div>
            <h3 className="font-display text-xl uppercase tracking-[0.03em] text-ink mb-2">Q: When do picks lock?</h3>
            <p className="text-[17px] leading-relaxed text-ink">A: Whenever your organiser sets the deadline for that round — there&apos;s no automatic buffer before kickoff. The deadline is shown on your dashboard and again when you make your pick, so check there rather than assuming a fixed time.</p>
          </div>

          <div>
            <h3 className="font-display text-xl uppercase tracking-[0.03em] text-ink mb-2">Q: How are ties handled?</h3>
            <p className="text-[17px] leading-relaxed text-ink">A: If multiple players are eliminated in the same round with no one left, they all share the victory.</p>
          </div>

          <div>
            <h3 className="font-display text-xl uppercase tracking-[0.03em] text-ink mb-2">Q: Can eliminated players rejoin?</h3>
            <p className="text-[17px] leading-relaxed text-ink">A: No, once eliminated you&apos;re out for that competition. You can join other competitions or wait for the next season.</p>
          </div>

          <div>
            <h3 className="font-display text-xl uppercase tracking-[0.03em] text-ink mb-2">Q: How long do competitions last?</h3>
            <p className="text-[17px] leading-relaxed text-ink">A: Varies by competition - could be a full season (38+ weeks) or shorter custom competitions.</p>
          </div>
        </div>
      </div>

      {/* Privacy & Security */}
      <div className="bg-stock-lit rounded-none p-8 mb-8 border">
        <h2 className="font-display text-4xl font-semibold uppercase leading-[0.9] text-ink mb-6 flex items-center">
          <span className="text-2xl mr-3">🔒</span>
          Privacy & Security
        </h2>

        <div className="space-y-6">
          <div>
            <h3 className="font-display text-xl uppercase tracking-[0.03em] text-ink mb-2">Q: Is my data safe?</h3>
            <p className="text-[17px] leading-relaxed text-ink">A: Yes, we use industry-standard encryption and never share personal data without consent.</p>
          </div>

          <div>
            <h3 className="font-display text-xl uppercase tracking-[0.03em] text-ink mb-2">Q: Can other players see my picks?</h3>
            <div className="text-[17px] leading-relaxed text-ink">
              <p>A: It depends on timing:</p>
              <ul className="mt-2 space-y-1 ml-4">
                <li>• Before deadline: No, picks are hidden</li>
                <li>• After deadline: Yes, all picks become visible</li>
              </ul>
            </div>
          </div>

          <div>
            <h3 className="font-display text-xl uppercase tracking-[0.03em] text-ink mb-2">Q: Can I delete my account?</h3>
            <p className="text-[17px] leading-relaxed text-ink">A: Yes, you can delete your account from the profile settings. This removes you from all active competitions.</p>
          </div>
        </div>
      </div>

      {/* Support CTA */}
      <div className="border border-ink/30 bg-stock-lit p-8 text-center">
        <h2 className="font-display text-4xl font-semibold uppercase leading-[0.9] text-ink mb-4">Still Have Questions?</h2>
        <p className="text-[17px] leading-relaxed text-ink mb-6">
          Can&apos;t find what you&apos;re looking for? Our support team is here to help,
          or you can ask your competition organiser directly.
        </p>
        <div className="flex justify-center gap-4">
          <a
            href="mailto:lmslocal8@gmail.com"
            className="px-6 py-3 rounded-sm bg-overprint font-display uppercase tracking-[0.06em] text-stock-lit transition-opacity hover:opacity-90"
          >
            📧 Contact Support
          </a>
          <a
            href="/help"
            className="px-6 py-3 bg-stock-lit text-ink border rounded-none hover:bg-stock-lit transition-colors"
          >
            Browse Help Center
          </a>
        </div>
      </div>
    </div>
  );
}