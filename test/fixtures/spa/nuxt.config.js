function modifyHtml (html) {
  return html.replace(
    '</body>',
    `<!-- extra html from render:route hook added at ${Date.now()}--></body>`
  )
}

export default {
  mode: 'spa',
  pageTransition: false,
  render: {
    http2: {
      push: true
    },
    bundleRenderer: {
      shouldPrefetch: () => true
    }
  },
  build: {
    filenames: {
      app: '[name].js',
      chunk: '[name].js'
    }
  },
  router: {
    middleware: 'middleware'
  },
  plugins: [
    '~/plugins/error.js',
    '~/plugins/path.js'
  ],
  hooks: {
    'render:route': (url, page, { req, res }) => {
      page.html = modifyHtml(page.html)
    }
  }
}
