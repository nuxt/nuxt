import { vaporInteropPlugin } from 'vue'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(vaporInteropPlugin)
})
