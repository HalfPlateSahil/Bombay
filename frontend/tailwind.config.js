/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/modules/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#080c14",
        card: "rgba(15, 23, 42, 0.75)",
        cardBorder: "rgba(56, 189, 248, 0.2)",
        accentCyan: "#00f0ff",
        accentBlue: "#3b82f6",
        hazardRed: "#ef4444",
        warningOrange: "#f97316",
        cautionYellow: "#eab308",
        successGreen: "#10b981",
      },
      backdropBlur: {
        glass: "16px",
      },
      boxShadow: {
        glowCyan: "0 0 25px rgba(0, 240, 255, 0.25)",
        glowRed: "0 0 25px rgba(239, 68, 68, 0.3)",
      }
    },
  },
  plugins: [],
};
