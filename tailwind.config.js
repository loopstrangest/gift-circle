/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          gold: {
            light: "#E1C158",
            DEFAULT: "#D4AF37",
            dark: "#B29700",
          },
          green: {
            light: "#7DAA6A",
            DEFAULT: "#619A46",
            dark: "#438029",
          },
          sand: {
            50: "#FDF8EB",
            100: "#F8F0D6",
            200: "#EBD5A3",
            300: "#D9B66E",
            400: "#C1963F",
          },
          ink: {
            900: "#1B1A16",
            800: "#2C2A25",
            700: "#3F3B33",
            600: "#575246",
            500: "#716A59",
          },
        },
      },
      boxShadow: {
        card: "0 18px 45px -30px rgba(27, 26, 22, 0.65)",
        "card-soft": "0 12px 30px -18px rgba(27, 26, 22, 0.4)",
      },
      borderRadius: {
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
    },
  },
  plugins: [],
};
