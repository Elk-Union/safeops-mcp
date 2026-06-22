/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: "#09090b",       // Deep dark charcoal
          card: "#121214",     // Sleek card container dark gray
          border: "#27272a",   // Fine border gray
          cyan: "#00f0ff",     // Glowing cyber cyan accent
          emerald: "#10b981",  // Active status success green
          amber: "#f59e0b",    // Caution warning amber
          rose: "#f43f5e"      // Security block critical red
        }
      },
      boxShadow: {
        glow: "0 0 15px rgba(0, 240, 255, 0.15)",
        successGlow: "0 0 15px rgba(16, 185, 129, 0.15)"
      }
    },
  },
  plugins: [],
}
