window.app = new Vue({
  el: '#app',

  data() {
    return {
      finished: false,
      bundles: [],
      states: {
        client: {
          progress: 0,
          status: 'Bundling...'
        },
        server: {
          progress: 0,
          status: 'Bundling...'
        },
        modern: {
          progress: 0,
          status: 'Bundling...'
        }
      }
    }
  },

  mounted() {
    this.wsConnect('/_ui/ws')
  },

  methods: {
    onWSData(data) {
      if (!data || !data.states) {
        return
      }

      let isFinished = true

      this.bundles = data.states.map(state => state.name.toLowerCase())

      for (const state of data.states) {
        const bundle = state.name.toLowerCase()

        this.states[bundle].progress = state.progress
        this.states[bundle].status = state.details.length ? state.details.slice(0, 2).join(' ') : 'Done'

        if (!state.done) {
          isFinished = false
        }
      }

      if (!this.isFinished && isFinished) {
        setTimeout(() => this.showNuxtApp(), 300)
      }

      this.isFinished = isFinished
    },

    async showNuxtApp() {
      // Close websockets connection
      this.ws.close()

      // Clear console
      this.clearConsole()

      // If fetch does not exist, hard reload the page
      if (typeof window.fetch !== 'function') {
        return window.location.reload(true)
      }

      // Transition to the Nuxt app
      const html = await fetch(location.href).then(res => res.text())
      document.open()
      document.write(html)
      document.close()
    }
  }
})
