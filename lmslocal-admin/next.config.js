/** @type {import('next').NextConfig} */
const nextConfig = {
  // Internal tool - keep it out of every index, at the header level as well as the meta tag.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow, noarchive',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
