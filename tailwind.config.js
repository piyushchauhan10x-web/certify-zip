module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: '#F5F3ED', surface: '#FFFFFF', 'surface-hover': '#EFEEE7',
        border: '#DCDDD4', 'border-hover': '#17634D', accent: '#17634D',
        'accent-glow': 'rgba(23,99,77,.15)', text: '#20392F',
        vanilla: '#20392F', 'vanilla-muted': '#52665C', muted: '#617268',
        gray: { 50:'#F8F8F3',100:'#EFEEE7',200:'#DEE2D9',300:'#C8D0C5',400:'#738174',500:'#637265',600:'#506154',700:'#3D5144',800:'#2C4436',900:'#20392F' },
      },
      fontFamily: {
        display: ["var(--font-sora)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
      },
    },
  },
  plugins: [],
};
