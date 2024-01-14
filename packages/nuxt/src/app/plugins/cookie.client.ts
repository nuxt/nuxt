import { defineNuxtPlugin } from '../nuxt'
import { refreshCookie } from '../composables/cookie'

export default defineNuxtPlugin({
  name: 'nuxt:cookie',
  setup () {
    if (typeof window.cookieStore === 'undefined') return

    window.cookieStore.onchange = (event) => 
      event.changed.forEach((cookie: any) => refreshCookie(cookie.name))
  }
})
