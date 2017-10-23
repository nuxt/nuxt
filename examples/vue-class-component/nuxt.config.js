module.exports = {
  build: {
    babel: {
      plugins: ['transform-decorators-legacy', 'transform-class-properties']
    },
    extend (config) {
      config.resolve.alias['nuxt-class-component'] = '@/plugins/nuxt-class-component'
    }
  }
}
