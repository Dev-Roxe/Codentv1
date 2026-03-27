module.exports = {
  darkMode: 'class',
  content: [
    "./src/renderer/views/**/*.{html,js}",
    "./src/renderer/scripts/**/*.js",
    "./src/renderer/components/**/*.{html,js}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4EABBE',
          dark: '#1D5D69',
          light: '#8BCFDD',
        },
        base: {
          light: '#F8F7F7',
          dark: '#0F2532',
        },
      },
    },
  },
  plugins: [],
};
