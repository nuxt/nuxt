module.exports = {
  plugins: [
    require('tailwindcss')('./tailwind.js'),
    require('postcss-import'),
    require('autoprefixer')
  ]
}
