/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0A0A0A', // Deep Velvet Black
        secondary: '#262626', // Industrial Concrete/Grey
        accent: '#D4AF37', // Metallic Gold/Brass
        background: '#050505', // Total Noir
        text: '#F5F5F5', // Off-White
        muted: '#8A8A8A', // Ash Grey
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
}
