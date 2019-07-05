import NuxtConfiguration from '@nuxt/config'

const config: NuxtConfiguration = {
  build: {
    loaders: {
      vueStyle: {
        manualInject: true
      },
      css: {
        modules: {
          localIdentName: '[local]_[hash:base64:5]'
        },
        importLoaders: 1
      }
    }
  }
}

export default config
