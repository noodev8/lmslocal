import { MetadataRoute } from 'next'

/*
  The public sitemap.

  `lastModified` is a literal date per page, not `new Date()`. Stamping build time on every URL
  told Google that thirteen pages change every time we deploy anything, including the ones that
  have not changed in months — and a lastmod that is always today is a signal it learns to
  discount entirely. Move a date when you meaningfully change that page's content; leave it alone
  for a styling tweak.

  Only pages a stranger can reach and would want: nothing behind a login, which robots.ts
  disallows anyway.
*/

const baseUrl = 'https://lmslocal.co.uk'

type Route = {
  path: string
  lastModified: string
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']
  priority: number
}

const ROUTES: Route[] = [
  { path: '', lastModified: '2026-08-18', changeFrequency: 'monthly', priority: 1 },
  { path: '/pricing', lastModified: '2026-08-21', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/help', lastModified: '2026-08-21', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/help/how-to-play', lastModified: '2026-08-21', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/help/faq', lastModified: '2026-08-24', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/help/fundraising', lastModified: '2026-08-24', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/help/is-it-gambling', lastModified: '2026-08-24', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/help/getting-started/organizers', lastModified: '2026-08-21', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/help/getting-started/players', lastModified: '2026-08-21', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/help/support', lastModified: '2026-08-04', changeFrequency: 'yearly', priority: 0.6 },
  { path: '/login', lastModified: '2026-08-11', changeFrequency: 'yearly', priority: 0.8 },
  { path: '/register', lastModified: '2026-08-07', changeFrequency: 'yearly', priority: 0.8 },
  { path: '/terms', lastModified: '2026-08-04', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/privacy', lastModified: '2026-08-04', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/forgot-password', lastModified: '2026-08-21', changeFrequency: 'yearly', priority: 0.2 }
]

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((route) => ({
    url: `${baseUrl}${route.path}`,
    lastModified: new Date(route.lastModified),
    changeFrequency: route.changeFrequency,
    priority: route.priority
  }))
}
