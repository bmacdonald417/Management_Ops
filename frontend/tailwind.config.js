/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'system-ui', 'sans-serif']
      },
      colors: {
        gov: {
          navy: '#0f172a',
          slate: '#1e293b',
          blue: '#1d4ed8',
          'blue-light': '#3b82f6'
        }
      }
    }
  },
  plugins: []
};
