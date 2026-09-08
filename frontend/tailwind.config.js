/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Google Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs: ['0.8125rem', { lineHeight: '1.125rem', letterSpacing: '0.01em' }],
        sm: ['0.9375rem', { lineHeight: '1.375rem' }],
        base: ['1.0625rem', { lineHeight: '1.625rem' }],
        lg: ['1.1875rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em' }],
        xl: ['1.3125rem', { lineHeight: '1.875rem', letterSpacing: '-0.015em' }],
        '2xl': ['1.5625rem', { lineHeight: '2.125rem', letterSpacing: '-0.02em' }],
        '3xl': ['1.875rem', { lineHeight: '2.375rem', letterSpacing: '-0.02em' }],
      },
      colors: {
        accent: {
          DEFAULT: '#3ecf8e',
          hover: '#32b87a',
        },
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
      },
    },
  },
  plugins: [],
};
