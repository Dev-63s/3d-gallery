import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-jakarta)', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          300: '#c5e68a',
          400: '#a8d96a',
          500: '#8BC34A',   // Sixtrees Green
          600: '#73a33a',
          700: '#547a2b',
        },
        site: {
          grey:  '#8F847E',  // Sixtrees Grey
          black: '#111111',  // Sixtrees Black
        },
      },
    },
  },
  plugins: [],
}

export default config
