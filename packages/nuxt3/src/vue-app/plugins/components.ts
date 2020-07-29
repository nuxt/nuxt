import type { Plugin } from 'nuxt/vue-app/types'

// import { h, defineComponent } from 'vue'
import { RouterLink } from 'vue-router'

// const NuxtLink = defineComponent({
//   extends: Link
// })

const components: Plugin = function ({ app }) {
  app.component('NuxtLink', RouterLink)
  app.component('NLink', RouterLink) // TODO: deprecate
}

export default components