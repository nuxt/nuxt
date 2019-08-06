const path = require('path')
const purgecss = require('@fullhuman/postcss-purgecss')

const tailwindConfig = path.join(__dirname, 'tailwind.js')

class TailwindExtractor {
  static extract (content) {
    return content.match(/[A-Za-z0-9-_:\/]+/g) || [] // eslint-disable-line no-useless-escape
  }
}

module.exports = {
  plugins: [
    require('tailwindcss')(tailwindConfig),
    require('autoprefixer'),
    purgecss({
      content: [
        path.join(__dirname, './pages/**/*.vue'),
        path.join(__dirname, './layouts/**/*.vue'),
        path.join(__dirname, './components/**/*.vue')
      ],
      extractors: [
        {
          extractor: TailwindExtractor,
          extensions: ['vue', 'js', 'html']
        }
      ],
      whitelist: ['html', 'body', 'nuxt-progress']
    })
  ]
}
