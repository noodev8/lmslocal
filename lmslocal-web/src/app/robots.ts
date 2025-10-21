import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/login',
          '/register',
          '/help/*',
          '/terms',
          '/privacy',
          '/forgot-password'
        ],
        disallow: [
          '/dashboard',
          '/billing',
          '/profile',
          '/competition/*',
          '/game/*',
          '/api/*',
          '/_next/*',
          '/admin/*',
          '/admin-fixtures',
          '/admin-results'
        ],
      },
    ],
    sitemap: 'https://lmslocal.co.uk/sitemap.xml',
  }
}