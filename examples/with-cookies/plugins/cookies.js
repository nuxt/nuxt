import Vue from 'vue'
import Cookie from 'cookie'
import JSCookie from 'js-cookie'

// Called only on client-side
export const getCookies = (str) => {
  return Cookie.parse(str || '')
}

/*
** Executed by ~/.nuxt/index.js with context given
** This method can be asynchronous
*/
export default ({ req }, inject) => {
  // Inject `cookies` key
  // -> app.$cookies
  // -> this.$cookies in vue components
  // -> this.$cookies in store actions/mutations
  inject('cookies', new Vue({
    data: () => ({
      cookies: getCookies(process.server ? req.headers.cookie : document.cookie)
    }),
    methods: {
      set(...args) {
        JSCookie.set(...args)
        this.cookies = getCookies(document.cookie)
      },
      remove(...args) {
        JSCookie.remove(...args)
        this.cookies = getCookies(document.cookie)
      }
    }
  }))
}
