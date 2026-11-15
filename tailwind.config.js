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
        floatUp: {
          '0%': { transform: 'translateY(0) scale(1)', opacity: '1' },
          '100%': { transform: 'translateY(-28px) scale(1.25)', opacity: '0' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-4px)' },
          '75%': { transform: 'translateX(4px)' },
        },
        pulseRed: {
          '0%, 100%': { backgroundColor: 'rgb(127 29 29 / 0.35)' },
          '50%': { backgroundColor: 'rgb(220 38 38 / 0.55)' },
        },
      },
      animation: {
        pop: 'pop 160ms ease-out',
        pulseRed: 'pulseRed 1s ease-in-out infinite',
        floatUp: 'floatUp 900ms ease-out forwards',
        shake: 'shake 250ms ease-in-out 2',
      },
    },
  },
  plugins: [],
};
