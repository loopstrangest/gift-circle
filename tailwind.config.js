/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      colors: {
        brand: {
          // Warm, rich gold palette
          gold: {
            50: "#FFFBEB",
            100: "#FEF3C7",
            200: "#FDE68A",
            300: "#FCD34D",
            400: "#FBBF24",
            500: "#D4AF37", // Classic gold
            600: "#B8860B", // Dark goldenrod
            700: "#92400E",
            800: "#78350F",
            900: "#451A03",
          },
          // Deep forest green
          green: {
            50: "#F0FDF4",
            100: "#DCFCE7",
            200: "#BBF7D0",
            300: "#86EFAC",
            400: "#4ADE80",
            500: "#22C55E",
            600: "#16A34A",
            700: "#15803D",
            800: "#166534",
            900: "#14532D",
            950: "#052E16",
          },
          // Warm cream/ivory
          cream: {
            50: "#FFFEF7",
            100: "#FFFCEB",
            200: "#FEF7CD",
            300: "#FEF0A2",
            400: "#FDE577",
            500: "#FCD34D",
          },
          // Rich earthy tones
          earth: {
            50: "#FAF8F5",
            100: "#F5F0E8",
            200: "#E8DFD0",
            300: "#D4C4A8",
            400: "#BFA67A",
            500: "#A68B5B",
            600: "#8B7355",
            700: "#6B5A47",
            800: "#4A3F35",
            900: "#2D2620",
            950: "#1A1612",
          },
        },
      },
      boxShadow: {
        glow: "0 0 40px -10px rgba(212, 175, 55, 0.4)",
        "glow-green": "0 0 40px -10px rgba(22, 163, 74, 0.3)",
        soft: "0 25px 50px -12px rgba(0, 0, 0, 0.08)",
        lifted: "0 20px 40px -15px rgba(0, 0, 0, 0.15), 0 10px 20px -10px rgba(0, 0, 0, 0.08)",
        dramatic: "0 35px 60px -15px rgba(0, 0, 0, 0.25)",
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
      animation: {
        "fade-in": "fadeIn 0.6s ease-out forwards",
        "fade-up": "fadeUp 0.7s ease-out forwards",
        "scale-in": "scaleIn 0.5s ease-out forwards",
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};
