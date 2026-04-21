/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        teal: { DEFAULT: '#1D9E75', deep: '#0F7A58', soft: '#E6F4EF' },
        amber: { DEFAULT: '#EF9F27', deep: '#C47B10', soft: '#FAEEDA' },
        ink: '#0A0A0A',
        text: '#1A1A1A',
        muted: '#6B6B6B',
        faint: '#9A9A9A',
        ghost: '#CCCCC6',
        line: '#ECECEC',
        'line-soft': '#F0F0EC',
        canvas: '#EFEEEA',
        surface: '#F6F6F4',
        card: '#FFFFFF',
        danger: '#D2453F',
      },
      borderRadius: { md: '8px', lg: '12px', xl: '16px' },
      fontWeight: { regular: '400', medium: '500' },
    },
  },
  plugins: [],
};
