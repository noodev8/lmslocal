/* eslint-disable @typescript-eslint/no-require-imports */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Landing page "pools coupon" system: tinted stock, two inks.
      colors: {
        // Three clearly separated grounds: banded section, page, lifted panel.
        'stock-deep': '#CDD3C4',
        stock: '#DDE1D6',
        'stock-lit': '#F2F3EC',
        ink: '#1C2620',
        // 6:1 on stock, so secondary text still passes WCAG AA.
        'ink-fade': '#4A5249',
        overprint: '#C8341E',
      },
      fontFamily: {
        display: ['var(--font-big-shoulders)', 'ui-sans-serif', 'sans-serif'],
        body: ['var(--font-instrument-sans)', 'ui-sans-serif', 'sans-serif'],
        data: ['var(--font-courier-prime)', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        'slide-in': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
      animation: {
        'slide-in': 'slide-in 0.3s ease-out',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}

