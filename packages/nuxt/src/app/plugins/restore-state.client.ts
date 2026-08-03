import { defineNuxtPlugin, useNuxtApp } from '../nuxt'
import type { ObjectPlugin, Plugin } from '../nuxt'

const plugin: Plugin & ObjectPlugin = defineNuxtPlugin({
  name: 'nuxt:restore-state',
  hooks: {
    'app:mounted' () {
      const nuxtApp = useNuxtApp()
      try {
        const state = sessionStorage.getItem('nuxt:reload:state')
        if (state) {
          sessionStorage.removeItem('nuxt:reload:state')
          Object.assign(nuxtApp.payload.state, JSON.parse(state)?.state)
        }
      } catch {
        // don't throw an error if we have issues reading sessionStorage
      }
    },
  },
})

export default plugin
