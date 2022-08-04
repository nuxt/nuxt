import { fileURLToPath } from 'node:url'
import { defineNuxtModule, addPlugin, useNuxt } from '@nuxt/kit'

export default defineNuxtModule({
  defaults: {
    enabled: true
  },
  meta: {
    name: 'my-module',
    configKey: 'sampleModule'
  },
  setup () {
    addPlugin(fileURLToPath(new URL('./runtime/plugin', import.meta.url)))
    useNuxt().hook('app:resolve', (app) => {
      app.middleware.push({
        name: 'unctx-test',
        path: fileURLToPath(new URL('./runtime/middleware', import.meta.url)),
        global: true
      })
    })
  }
})
