export default {
  build: {
    // You cannot use ~/ or @/ here since it's a Webpack plugin
    styleResources: {
      scss: './assets/variables.scss',
      less: './assets/*.less'
    }
  }
}
