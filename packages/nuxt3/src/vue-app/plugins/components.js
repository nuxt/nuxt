// import { h, defineComponent } from 'vue'
import { Link } from 'vue-router'

// const NuxtLink = defineComponent({
//   extends: Link
// })

export default function components ({ app }) {
  app.component('NuxtLink', Link)
  app.component('NLink', Link) // TODO: deprecate
}
