import { getCurrentInstance } from 'vue'
import { defineNuxtPlugin } from '#app/nuxt'

export default defineNuxtPlugin({
  name: 'nuxt:inject-route',
  setup (nuxtApp) {
    nuxtApp.vueApp.mixin({
      created () {
        const vm = getCurrentInstance()!
        // @ts-expect-error Vue internal type
        this.$route = vm.provides._route
      },
    })
  }
})
