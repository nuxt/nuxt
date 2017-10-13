import Vue from 'vue'
import NuxtChild from './nuxt-child'
import NuxtError from '<%= components.ErrorPage ? ((components.ErrorPage.includes('~') || components.ErrorPage.includes('@')) ? components.ErrorPage : "../" + components.ErrorPage) : "./nuxt-error.vue" %>'
import { compile } from '../utils'

export default {
  name: 'nuxt',
  props: ['nuxtChildKey'],
  render(h) {
    // If there is some error
    if (this.nuxt.err) {
      return h('nuxt-error', {
        props: {
          error: this.nuxt.err
        }
      })
    }
    // Directly return nuxt child
    return h('nuxt-child', {
      key: this.routerViewKey
    })
  },
  beforeCreate () {
    Vue.util.defineReactive(this, 'nuxt', this.$root.$options.nuxt)
  },
  computed: {
    routerViewKey () {
      // If nuxtChildKey prop is given or current route has children
      if (typeof this.nuxtChildKey !== 'undefined' || this.$route.matched.length > 1) {
        return this.nuxtChildKey || compile(this.$route.matched[0].path)(this.$route.params)
      }
      return this.$route.fullPath.split('#')[0]
    }
  },
  components: {
    NuxtChild,
    NuxtError
  }
}
