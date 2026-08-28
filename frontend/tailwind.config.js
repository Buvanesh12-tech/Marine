/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sentinel: {
          safe: "#3b82f6",     // Blue
          warning: "#eab308",  // Yellow
          critical: "#ef4444", // Red
        }
      }
    },
  },
  plugins: [],
}
