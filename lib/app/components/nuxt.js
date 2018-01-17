import Vue from 'vue'
import NuxtChild from './nuxt-child'
import NuxtError from '<%= components.ErrorPage ? ((components.ErrorPage.indexOf('~') === 0 || components.ErrorPage.indexOf('@') === 0) ? components.ErrorPage : "../" + components.ErrorPage) : "./nuxt-error.vue" %>'
import { compile } from '../utils'

export default {
  name: 'nuxt',
  props: ['nuxtChildKey', 'keepAlive'],
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
      key: this.routerViewKey,
      props: this.$props
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
      const Component = this.$route.matched[0] && this.$route.matched[0].components.default
      if (Component && Component.options && Component.options.key) {
        return (typeof Component.options.key === 'function' ? Component.options.key(this.$route) : Component.options.key)
      }
      return this.$route.path
    }
  },
  components: {
    NuxtChild,
    NuxtError
  }
}
