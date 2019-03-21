import NuxtConfiguration from '@nuxt/config'

const config: NuxtConfiguration = {
  build: {
    loaders: {
      vueStyle: {
        manualInject: true
      },
      css: {
        modules: true,
        importLoaders: 1,
        localIdentName: '[local]_[hash:base64:5]'
      }
    }
  }
}

export default config
