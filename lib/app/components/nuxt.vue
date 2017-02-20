<template>
  <nuxt-error v-if="nuxt.err" :error="nuxt.err"></nuxt-error>
  <nuxt-child v-else></nuxt-child>
</template>

<script>
import Vue from 'vue'
import NuxtChild from './nuxt-child'
import NuxtError from '<%= components.ErrorPage ? components.ErrorPage : "./nuxt-error.vue" %>'

export default {
  name: 'nuxt',
  beforeCreate () {
    Vue.util.defineReactive(this, 'nuxt', this.$root.$options._nuxt)
  },
  created () {
    // Add this.$nuxt in child instances
    Vue.prototype.$nuxt = this
    // Add this.$root.$nuxt
    this.$root.$nuxt = this
    // Bind $nuxt.setLayout(layout) to $root.setLayout
    this.setLayout = this.$root.setLayout.bind(this.$root)
    // add to window so we can listen when ready
    if (typeof window !== 'undefined') {
      window.$nuxt = this
    }
    // Add $nuxt.error()
    this.error = this.$root.error
  },
  <% if (loading) { %>
  mounted () {
    if (this.$root.$loading && this.$root.$loading.start) {
      this.$loading = this.$root.$loading
    }
  },
  watch: {
    'nuxt.err': 'errorChanged'
  },
  methods: {
    errorChanged () {
      if (this.nuxt.err && this.$loading) {
        if (this.$loading.fail) this.$loading.fail()
        if (this.$loading.finish) this.$loading.finish()
      }
    }
  },
  <% } %>
  components: {
    NuxtChild,
    NuxtError
  }
}
</script>
