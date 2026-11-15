/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './lib/**/*.{js,jsx}'],
  theme: {
    extend: {
      keyframes: {
        pop: {
          '0%': { transform: 'scale(0.85)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        pulseRed: {
          '0%, 100%': { backgroundColor: 'rgb(127 29 29 / 0.35)' },
          '50%': { backgroundColor: 'rgb(220 38 38 / 0.55)' },
        },
      },
      animation: {
        pop: 'pop 160ms ease-out',
        pulseRed: 'pulseRed 1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
