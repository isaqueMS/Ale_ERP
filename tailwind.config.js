/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Rosa pastel — identidade da marca, usado como cor de destaque/ação,
        // nunca como cor de fundo dominante (ver diretriz de design v2: "Luxury
        // Beauty SaaS" — rosa como elemento de marca, não como tema geral).
        primary: '#E38EA0',
        'primary-dark': '#C15F76',
        secondary: '#FCF2F1',   // superfície suave rosada, uso pontual
        accent: '#C15F76',      // rosa mais forte, para ênfase/hover
        background: '#FBF7F6',  // fundo geral, neutro com leve viés rosado
        // Texto: grafite neutro (era um marrom-rosa mais quente) — lê como
        // software premium/empresarial em vez de "feito à mão".
        text: '#27262B',
        muted: '#75727A',
        sidebar: '#FFFFFF',

        // Escala "pink" usada em quase todo componente (bg-pink-50, text-pink-300,
        // shadow-pink-100 etc.) — mesma paleta rosa dessaturada da marca.
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
        // Plus Jakarta Sans: geométrica, super legível, é a que mais aparece
        // em produtos SaaS premium modernos hoje (Linear/Vercel-adjacent) —
        // troca direta da Work Sans, sem mudar nenhuma lógica de layout.
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Fraunces fica só para os poucos momentos de marca (login, título de
        // boas-vindas) — mantém a feminilidade sofisticada sem virar o corpo
        // de texto do produto inteiro.
        display: ['"Fraunces"', 'Georgia', 'serif'],
      },
      borderRadius: {
        // Escala mais slim — o antigo "bubble" (2rem–2.5rem) lia como app de
        // consumo; isso aqui lê como produto empresarial sem virar quadrado.
        '3xl': '1rem',
        '4xl': '1.25rem',
        '5xl': '1.5rem',
      },
      boxShadow: {
        // Sombra de marca, agora bem mais discreta (era um "glow" rosa forte).
        'doll': '0 10px 24px -16px rgba(227, 142, 160, 0.28)',
        // Elevação neutra de card premium, para uso consistente no lugar de
        // sombras ad-hoc (shadow-xl, shadow-2xl) espalhadas pelas telas.
        'card': '0 1px 2px rgba(23, 23, 28, 0.04), 0 8px 24px -12px rgba(23, 23, 28, 0.08)',
        'card-hover': '0 2px 4px rgba(23, 23, 28, 0.05), 0 16px 32px -12px rgba(23, 23, 28, 0.12)',
      }
    },
  },
  plugins: [],
}
