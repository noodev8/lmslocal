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
      <div className="bg-slate-50 rounded-lg p-8 mb-8 border">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">
          Frequently Asked Questions
        </h1>
        <p className="text-lg text-slate-700">
          Find quick answers to common questions about Last Man Standing competitions,
          organizing events, and using the LMSLocal platform.
        </p>
      </div>

      {/* General Questions */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
          <span className="text-2xl mr-3">❓</span>
          General Questions
        </h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Q: What is Last Man Standing?</h3>
            <p className="text-slate-700">A: Last Man Standing (LMS) is an elimination-style competition where players pick one winning team each round. Wrong picks may lead to elimination, and the last player(s) remaining win.</p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Q: How much does it cost?</h3>
            <p className="text-slate-700">A: The platform is free to use. Individual competitions may have entry fees set by organizers - check with your competition organizer.</p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Q: Can I play on mobile?</h3>
            <p className="text-slate-700">A: Yes! LMSLocal works on all devices - phones, tablets, and computers.</p>
          </div>
        </div>
      </div>

      {/* For Organizers */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
          <span className="text-2xl mr-3">👥</span>
          For Organizers
        </h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Q: How many competitions can I run?</h3>
            <p className="text-slate-700">A: Unlimited! You can manage multiple competitions from a single account.</p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Q: Can I change rules after starting?</h3>
            <div className="text-slate-700">
              <p>A: It depends on what you want to change:</p>
              <ul className="mt-2 space-y-1 ml-4">
                <li>• Competition name and description: Yes, anytime</li>
                <li>• Lives and No Team Twice rule: No, locked after first round starts</li>
              </ul>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Q: How do I handle disputes?</h3>
            <div className="text-slate-700">
              <p>A: You have full control to:</p>
              <ul className="mt-2 space-y-1 ml-4">
                <li>• Override any player's pick</li>
                <li>• Adjust match results</li>
                <li>• Add or remove players</li>
                <li>• Make final decisions on edge cases</li>
              </ul>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Q: What if I enter wrong results?</h3>
            <p className="text-slate-700">A: You can edit match results at any time. The system will automatically recalculate eliminations.</p>
          </div>
        </div>
      </div>

      {/* For Players */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
          <span className="text-2xl mr-3">⚽</span>
          For Players
        </h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Q: Can I change my pick?</h3>
            <p className="text-slate-700">A: No, picks are final once submitted. Double-check before confirming!</p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Q: What if I forget to pick?</h3>
            <p className="text-slate-700">A: Missing a pick counts as a wrong pick. You'll lose a life (or be eliminated in knockout format).</p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Q: Can I join multiple competitions?</h3>
            <p className="text-slate-700">A: Yes! You can join as many competitions as you want with the same account.</p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Q: How do I know if I'm eliminated?</h3>
            <p className="text-slate-700">A: Check your competition dashboard - your status will show as "Eliminated" and you'll see which round you went out.</p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Q: What happens if my team's match is postponed?</h3>
            <p className="text-slate-700">A: Usually, postponed matches are void (no win or loss), but check with your organizer for their specific rules.</p>
          </div>
        </div>
      </div>

      {/* Technical Questions */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
          <span className="text-2xl mr-3">🔧</span>
          Technical Questions
        </h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Q: I can't log in - help!</h3>
            <div className="text-slate-700">
              <p>A: Try these steps:</p>
              <ol className="mt-2 space-y-1 ml-4 list-decimal">
                <li>Check you're using the correct email</li>
                <li>Try the "Forgot Password" option</li>
                <li>Clear your browser cache</li>
                <li>Contact support if issues persist</li>
              </ol>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Q: How do I join a competition?</h3>
            <div className="text-slate-700">
              <p>A: Two ways:</p>
              <ol className="mt-2 space-y-1 ml-4 list-decimal">
                <li>Enter the 6-character invite code</li>
                <li>Click a direct link from your organizer</li>
              </ol>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Q: Can I use the same team twice?</h3>
            <p className="text-slate-700">A: In most competitions, no. The "No Team Twice" rule prevents reusing teams. Check your competition settings.</p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Q: What timezone are deadlines in?</h3>
            <p className="text-slate-700">A: All times are shown in your local timezone automatically.</p>
          </div>
        </div>
      </div>

      {/* Competition Management */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
          <span className="text-2xl mr-3">⚙️</span>
          Competition Management
        </h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Q: When do picks lock?</h3>
            <p className="text-slate-700">A: Default: 1 hour before the first match of the round. Organizers can set custom deadlines.</p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Q: How are ties handled?</h3>
            <p className="text-slate-700">A: If multiple players are eliminated in the same round with no one left, they all share the victory.</p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Q: Can eliminated players rejoin?</h3>
            <p className="text-slate-700">A: No, once eliminated you're out for that competition. You can join other competitions or wait for the next season.</p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Q: How long do competitions last?</h3>
            <p className="text-slate-700">A: Varies by competition - could be a full season (38+ weeks) or shorter custom competitions.</p>
          </div>
        </div>
      </div>

      {/* Privacy & Security */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
          <span className="text-2xl mr-3">🔒</span>
          Privacy & Security
        </h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Q: Is my data safe?</h3>
            <p className="text-slate-700">A: Yes, we use industry-standard encryption and never share personal data without consent.</p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Q: Can other players see my picks?</h3>
            <div className="text-slate-700">
              <p>A: It depends on timing:</p>
              <ul className="mt-2 space-y-1 ml-4">
                <li>• Before deadline: No, picks are hidden</li>
                <li>• After deadline: Yes, all picks become visible</li>
              </ul>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Q: Can I delete my account?</h3>
            <p className="text-slate-700">A: Yes, you can delete your account from the profile settings. This removes you from all active competitions.</p>
          </div>
        </div>
      </div>

      {/* Support CTA */}
      <div className="bg-slate-50 rounded-lg p-8 text-center border">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Still Have Questions?</h2>
        <p className="text-slate-700 mb-6">
          Can't find what you're looking for? Our support team is here to help,
          or you can ask your competition organizer directly.
        </p>
        <div className="flex justify-center gap-4">
          <a
            href="/help/support"
            className="px-6 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            Contact Support
          </a>
          <a
            href="/help"
            className="px-6 py-3 bg-white text-slate-800 border rounded-lg hover:bg-slate-100 transition-colors"
          >
            Browse Help Center
          </a>
        </div>
      </div>
    </div>
  );
}