<%= isTest ? '// @vue/component' : '' %>
import Vue from 'vue'

export default {
  extends: Vue.component('RouterLink'),
  name: 'NuxtLink',
  props: {
    noPrefetch: {
      type: Boolean,
      default: false
    }
  },
  mounted() {
    if (!this.noPrefetch) {
      this.$nextTick(this.prefetch)
    }
  },
  methods: {
    prefetch() {
      if (process.client) {
        // Avoid including it in SSR bundle
        var ref = this.$router.resolve(this.to, this.$route, this.append)
        const Components = ref.resolved.matched.map((r) => r.components.default)
        for (let i = 0; i < Components.length; i++) {
          const Component = Components[i]
          if (typeof Component === 'function' && !Component.__prefetched) {
            try {
              Component()
              Component.__prefetched = true
            } catch (e) {}
          }
        }
      }
    }
  }
}
