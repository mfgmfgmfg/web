/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        'pastel-pink': '#FFDFD3',
        'pastel-blue': '#D4E4F7',
        'pastel-green': '#D1E7DD',
        'pastel-yellow': '#FCF4DD',
        'pastel-purple': '#E8DFF5',
        'pastel-gray': '#F5F5F5',
        'dark-text': '#3A3A3A',
        'medium-gray': '#757575',
      },
      boxShadow: {
        'deep': '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.2)',
      },
      transitionTimingFunction: {
        'soft-reveal': 'cubic-bezier(0.25, 0.1, 0.25, 1)',
      }
    },
  },
  plugins: [],
};
