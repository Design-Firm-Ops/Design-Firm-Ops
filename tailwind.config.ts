import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Sourced from CSS custom properties in globals.css (single
        // source of truth for the brand palette) — the rgb(<alpha-value>)
        // form keeps Tailwind's opacity modifiers (bg-gold/90, etc.) working.
        brown: {
          DEFAULT: 'rgb(var(--brown) / <alpha-value>)',
          dark: 'rgb(var(--brown-dark) / <alpha-value>)',
        },
        cream: 'rgb(var(--cream) / <alpha-value>)',
        gold: 'rgb(var(--gold) / <alpha-value>)',
        taupe: 'rgb(var(--taupe) / <alpha-value>)',
      },
      fontFamily: {
        serif: ['var(--font-lora)', 'Georgia', 'serif'],
        sans: ['var(--font-poppins)', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
