/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{ts,html}",
    "./public/**/*.html"
  ],
  theme: {
    extend: {
      colors: {
        yellow: {
          primary: '#FFD700',
          secondary: '#FFA500',
          dark: '#FF8C00'
        }
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite'
      }
    }
  },
  plugins: []
}
