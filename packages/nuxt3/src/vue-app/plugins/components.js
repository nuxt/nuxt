// import { h, defineComponent } from 'vue'
import { RouterLink } from 'vue-router'

// const NuxtLink = defineComponent({
//   extends: Link
// })

export default function components ({ app }) {
  app.component('NuxtLink', RouterLink)
  app.component('NLink', RouterLink) // TODO: deprecate
}
