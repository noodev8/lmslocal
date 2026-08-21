/* eslint-disable @typescript-eslint/no-require-imports */
const withMDX = require('@next/mdx')({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: [],
    rehypePlugins: [],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  pageExtensions: ['ts', 'tsx', 'js', 'jsx', 'md', 'mdx'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  /*
   * The help centre used to be built twice: real Next pages under /help, and a set of flat HTML
   * files generated into public/help by scripts/build-help.js. The generated copies were served
   * at /help/faq.html and friends, were never linked from anywhere, and quietly went stale -
   * by the time they were deleted they still told players their picks were final and organisers
   * they could edit a result whenever they liked. Redirect rather than 404 so anything that did
   * find them lands on the page that is actually maintained.
   */
  async redirects() {
    return [
      { source: '/help/faq.html', destination: '/help/faq', permanent: true },
      { source: '/help/how-to-play.html', destination: '/help/how-to-play', permanent: true },
      {
        source: '/help/getting-started-organizers.html',
        destination: '/help/getting-started/organizers',
        permanent: true,
      },
    ];
  },

  // Headers for Universal Links / App Links
  async headers() {
    return [
      {
        source: '/.well-known/apple-app-site-association',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/json',
          },
        ],
      },
      {
        source: '/.well-known/assetlinks.json',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/json',
          },
        ],
      },
    ];
  },
};

module.exports = withMDX(nextConfig);