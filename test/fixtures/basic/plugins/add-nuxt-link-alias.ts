import { NuxtLink } from '#components'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.component('NuxtLinkAlias', NuxtLink)
})
