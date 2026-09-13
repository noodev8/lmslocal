/*
  Site-wide structured data: who we are, what the site is, what the thing costs.

  Separate from the per-page schema on /help/faq and /help/how-to-play, which describes one
  page's content. This describes the product, and it is what an assistant asked "what is
  LMSLocal" has to go on - without it there was no machine-readable answer anywhere on the site.

  Rendered from the root layout, so it is on every page including the signed-in ones. That is
  deliberate and normal: one canonical @id per entity, referenced rather than repeated.

  RULES FOR EDITING
  - Every claim here must be true on a page a visitor can read. Schema that overstates the
    product is worse than no schema - it is the version Google quotes back.
  - The prices must match /pricing and what the billing screen sells. If a pack changes, change
    it here in the same commit.
  - No aggregateRating and no review. We have no collected ratings, and inventing them is both
    a manual-action risk and against the copy rules in docs/design-system.md.
*/

const ORGANISATION_ID = 'https://lmslocal.co.uk/#organisation';
const WEBSITE_ID = 'https://lmslocal.co.uk/#website';

const SCHEMA = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': ORGANISATION_ID,
      name: 'LMSLocal',
      url: 'https://lmslocal.co.uk',
      logo: 'https://lmslocal.co.uk/logo.png',
      email: 'lmslocal8@gmail.com',
      description:
        'LMSLocal runs Last Man Standing football competitions for pubs, workplaces, clubs and charity fundraisers.',
      areaServed: 'GB'
    },
    {
      '@type': 'WebSite',
      '@id': WEBSITE_ID,
      url: 'https://lmslocal.co.uk',
      name: 'LMSLocal',
      publisher: { '@id': ORGANISATION_ID },
      inLanguage: 'en-GB'
    },
    {
      '@type': 'WebApplication',
      '@id': 'https://lmslocal.co.uk/#app',
      name: 'LMSLocal',
      url: 'https://lmslocal.co.uk',
      applicationCategory: 'SportsApplication',
      // Organisers run a competition in the browser; there is no organiser app. The player
      // apps are separate nodes below - do not merge them into this one, they are different
      // products with different audiences and their own store pages.
      operatingSystem: 'Any - runs in a web browser',
      browserRequirements: 'Requires JavaScript. Works on phones, tablets and desktop browsers.',
      publisher: { '@id': ORGANISATION_ID },
      isPartOf: { '@id': WEBSITE_ID },
      inLanguage: 'en-GB',
      description:
        'Set up and run a Last Man Standing competition: players pick one team to win each round, a loss or a draw costs them, and the last player standing takes the prize. Fixtures and results can be supplied for you or entered yourself.',
      featureList: [
        'Automatic fixtures and results for covered leagues',
        'Ready-made WhatsApp invites, social images and a join QR code',
        'One team per round, no team twice',
        'Lives, so one bad week need not end a run',
        'Players join free with a code, in a browser or the iPhone and Android apps'
      ],
      offers: [
        {
          '@type': 'Offer',
          name: 'Free tier',
          description: '20 player places, shared across every competition you run, yours for good with no card needed.',
          price: '0',
          priceCurrency: 'GBP',
          url: 'https://lmslocal.co.uk/pricing'
        },
        {
          '@type': 'Offer',
          name: 'Starter pack',
          description: '20 additional player places.',
          price: '10',
          priceCurrency: 'GBP',
          url: 'https://lmslocal.co.uk/pricing'
        },
        {
          '@type': 'Offer',
          name: 'Popular pack',
          description: '50 additional player places.',
          price: '20',
          priceCurrency: 'GBP',
          url: 'https://lmslocal.co.uk/pricing'
        },
        {
          '@type': 'Offer',
          name: 'Best value pack',
          description: '120 additional player places.',
          price: '40',
          priceCurrency: 'GBP',
          url: 'https://lmslocal.co.uk/pricing'
        }
      ]
    },
    /*
      THE PLAYER APPS.

      Added 2026-09-13. Search Console showed 258 impressions across "last man standing app",
      "last man standing football app" and friends at an average position of 9 - we were ranking
      for the app queries on a site whose only machine-readable summary said "no app to install".
      Page one for those terms is almost entirely App Store and Play listings, so the fix is
      twofold: say here that the apps exist, and name "Last Man Standing" in the store titles
      themselves, which is the field those listings actually rank on.

      These are PLAYER apps. An organiser cannot run a competition from them, so do not describe
      them as if they replace the web app - the store description is the honest version and this
      must not overstate it.
    */
    {
      '@type': 'MobileApplication',
      '@id': 'https://lmslocal.co.uk/#app-ios',
      name: 'LMS Local',
      operatingSystem: 'iOS',
      applicationCategory: 'SportsApplication',
      installUrl: 'https://apps.apple.com/gb/app/lms-local/id6755344736',
      publisher: { '@id': ORGANISATION_ID },
      isPartOf: { '@id': WEBSITE_ID },
      inLanguage: 'en-GB',
      description:
        'Join a Last Man Standing competition with a code, pick one team a round, and follow the standings from your phone. Free for players.',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' }
    },
    {
      '@type': 'MobileApplication',
      '@id': 'https://lmslocal.co.uk/#app-android',
      name: 'LMS Local',
      operatingSystem: 'ANDROID',
      applicationCategory: 'SportsApplication',
      installUrl: 'https://play.google.com/store/apps/details?id=uk.co.lmslocal.lmslocal_flutter',
      publisher: { '@id': ORGANISATION_ID },
      isPartOf: { '@id': WEBSITE_ID },
      inLanguage: 'en-GB',
      description:
        'Join a Last Man Standing competition with a code, pick one team a round, and follow the standings from your phone. Free for players.',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' }
    }
  ]
};

export default function SiteSchema() {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }} />
  );
}
