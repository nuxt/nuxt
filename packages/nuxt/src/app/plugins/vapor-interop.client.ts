import { vaporInteropPlugin } from 'vue'
import { defineNuxtPlugin } from '#app/nuxt'

// installed client-side only: node builds of vue do not include the vapor runtime,
// and SSR does not need it (vapor SFCs compile to regular ssr render functions).
// TODO: install on the server too once vue exposes vapor exports under the node
// condition (currently `vaporInteropPlugin` is undefined server-side), so that
// isomorphic code can reference vapor APIs without client-only guards
export default defineNuxtPlugin({
  name: 'nuxt:vapor-interop',
  enforce: 'pre',
  setup (nuxtApp) {
    nuxtApp.vueApp.use(vaporInteropPlugin)
  },
})
