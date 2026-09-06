/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Rosa pastel modernizado — evolução do tema antigo (Hot Pink / Deep Pink),
        // agora um rosa mais "desenhado"/dessaturado em vez do rosa-bebê cru.
        primary: '#E38EA0',
        'primary-dark': '#C15F76',
        secondary: '#FCF2F1',   // era Lavender Blush — tom de superfície suave rosada
        accent: '#C15F76',      // rosa mais forte, para ênfase/hover
        background: '#FBF7F6',  // fundo geral, neutro com leve viés rosado
        text: '#362A2B',        // texto principal (era um marrom-rosa mais escuro)
        muted: '#8C7876',       // texto secundário
        sidebar: '#FFFFFF',     // sidebar clara (era Misty Rose) — o rosa agora é só destaque

        // Sobrescreve a escala "pink" padrão do Tailwind (usada em quase todos os
        // componentes via bg-pink-50/text-pink-300/shadow-pink-100 etc.) para a
        // mesma paleta rosa dessaturada, em vez do magenta vivo padrão do Tailwind.
        pink: {
          50: '#FCEEF1',
          100: '#FBE8EC',
          200: '#F5D3DA',
          300: '#EDB4C0',
          400: '#E38EA0',
          500: '#D4738A',
          600: '#C15F76',
          700: '#A44A61',
          800: '#833C4E',
          900: '#5F2C39',
        },
      },
      fontFamily: {
        sans: ['"Work Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Fraunces"', 'Georgia', 'serif'],
      },
      borderRadius: {
        // Escala reduzida — "cantos mais sutis" em vez dos 2rem/2.5rem/3rem originais.
        '3xl': '1.25rem',
        '4xl': '1.5rem',
        '5xl': '1.75rem',
      },
      boxShadow: {
        'doll': '0 14px 32px -18px rgba(227, 142, 160, 0.35)',
      }
    },
  },
  plugins: [],
}
