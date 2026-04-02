/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#FF69B4', // Hot Pink
        secondary: '#FFF0F5', // Lavender Blush (very light pink)
        accent: '#FF1493', // Deep Pink
        background: '#FFF5F8', // Shell Pink
        text: '#4A2B33', // Dark Pink-Brown
        muted: '#A08B90', // Soft Pink-Grey
        sidebar: '#FFE4E1', // Misty Rose
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        '3xl': '1.5rem',
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        'doll': '0 10px 25px -5px rgba(255, 105, 180, 0.2)',
      }
    },
  },
  plugins: [],
}
