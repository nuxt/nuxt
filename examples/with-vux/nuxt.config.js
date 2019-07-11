import path from 'path'

import vuxLoader from 'vux-loader'

export default {
  head: {
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, user-scalable=0' }
    ]
  },
  css: [
    'vux/src/styles/reset.less',
    'vux/src/styles/1px.less'
  ],
  plugins: [
    {
      src: '~/plugins/vux-plugins',
      ssr: false
    },
    {
      src: '~/plugins/vux-components',
      ssr: true
    }
  ],
  build: {
    extend (config, { isDev, isClient }) {
      const configs = vuxLoader.merge(config, {
        options: {
          ssr: true
        },
        plugins: ['vux-ui', {
          name: 'less-theme',
          path: path.join(__dirname, './styles/theme.less')
        }]
      })
      return configs
    }
  }
}
