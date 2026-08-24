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
      // Nothing to install, which is itself a question people ask before signing up.
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
        'Players join free with a code, no app to install'
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
    }
  ]
};

export default function SiteSchema() {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }} />
  );
}
