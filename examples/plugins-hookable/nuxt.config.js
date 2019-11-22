// https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
function shuffleArray (array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = array[i]
    array[i] = array[j]
    array[j] = temp
  }
}

export default {
  features: {
    hookablePlugins: true,
    parallelPlugins: true
  },
  modules: [
    function () {
      const plugins = [
        '~/plugins/first.js',
        '~/plugins/second.js',
        '~/plugins/third.js'
      ]

      // shuffle the plugins to show that plugin order
      // doesnt matter
      shuffleArray(plugins)

      console.log('Plugin order:', plugins) // eslint-disable-line no-console
      this.options.plugins.push(...plugins)
    }
  ],
  plugins: [
    '~/plugins/setup.js'
  ]
}
