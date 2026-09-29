module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0A0908",             // Espresso obsidian base
        surface: "#14120E",        // Elevated warm charcoal card
        "surface-hover": "#1C1914",
        border: "rgba(255, 244, 214, 0.08)",       // Translucent Vanilla border
        "border-hover": "rgba(252, 108, 38, 0.35)", // Burnt Orange active border
        accent: "#FC6C26",         // Burnt Orange Primary
        "accent-glow": "rgba(252, 108, 38, 0.28)",
        vanilla: "#FFF4D6",        // Warm Vanilla accent/text
        "vanilla-muted": "#D6CBB2",
        muted: "#8C8270",          // Muted warm stone
      },
      fontFamily: {
        display: ["var(--font-sora)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
      },
    },
  },
  plugins: [],
};
