module.exports = {
  build: {
    postcss: [
      require('tailwindcss')('./tailwind.js'),
      require('autoprefixer')
    ],
  },
  css: ['~/assets/css/tailwind.css']
}
