import { defineComponent, h } from 'vue'

const Spin = defineComponent({
  setup (props, { slots }) {
    return () => {
      return h('div', slots.default?.())
    }
  }
})

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.component('Spin', Spin)
})
