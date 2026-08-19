import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        neoYellow: "var(--neo-yellow)",
        neoViolet: "var(--neo-violet)",
        neoMint: "var(--neo-mint)",
        neoPink: "var(--neo-pink)",
        neoBlue: "var(--neo-blue)",
        neoOrange: "var(--neo-orange)",
        neoCream: "var(--background)",
        black: "#1D2A44",
      },
      borderWidth: {
        '3': '3px',
        '4': '4px',
        '8': '8px',
      },
      boxShadow: {
        'neo': '4px 4px 0px 0px #1D2A44',
        'neo-lg': '8px 8px 0px 0px #1D2A44',
        'neo-sm': '2px 2px 0px 0px #1D2A44',
      },
      fontFamily: {
        sans: ["var(--font-body)", "sans-serif"],
        heading: ["var(--font-heading)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      fontSize: {
        'xxs': '0.65rem',
      }
    },
  },
  plugins: [],
};
export default config;
