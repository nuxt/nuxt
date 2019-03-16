export default {
  methods: {
    log(...args) {
      console.log(...args) // eslint-disable-line no-console
    },

    logError(...args) {
      console.error(...args) // eslint-disable-line no-console
    },

    clearConsole() {
      if (typeof console.clear === 'function') { // eslint-disable-line no-console
        console.clear() // eslint-disable-line no-console
      }
    }
  }
}
