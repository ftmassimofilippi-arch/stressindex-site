import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        teal: {
          DEFAULT: '#4FA39A',
          dark: '#2E746C',
          light: '#E8F4F3',
          mid: '#C2DFDD',
          50: '#F0F9F8',
          100: '#E8F4F3',
          200: '#C2DFDD',
          300: '#8DC5BF',
          400: '#4FA39A',
          500: '#4FA39A',
          600: '#3D8A82',
          700: '#2E746C',
          800: '#245C56',
          900: '#1A4540',
        },
        anthracite: {
          DEFAULT: '#2F343A',
          light: '#4A5058',
          lighter: '#6B7280',
        },
        surface: {
          DEFAULT: '#F6F7F8',
          white: '#FFFFFF',
          border: '#E2E6EA',
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace'],
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
        'elevated': '0 10px 30px rgba(0,0,0,0.1)',
      },
    },
  },
  plugins: [],
}

export default config
