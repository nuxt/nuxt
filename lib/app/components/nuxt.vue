<template>
  <div>
    <% if (loading) { %><nuxt-loading ref="loading"></nuxt-loading><% } %>
    <transition>
      <router-view v-if="!err"></router-view>
      <nuxt-error v-if="err" :error="err"></nuxt-error>
    </transition>
  </div>
</template>

<script>
import NuxtError from '<%= components.ErrorPage %>'
<% if (loading) { %>import NuxtLoading from '<%= (typeof loading === "string" ? loading : "./nuxt-loading.vue") %>'<% } %>

export default {
  name: 'nuxt',
  data () {
    return {
      err: null
    }
  },
  <% if (loading) { %>
  created () {
    if (this.$root.$nuxt) {
      return console.error('Only one instance of Nuxt.js is possible, make sure to use <nuxt></nuxt> only once.')
    }
    // Add $nuxt in the root instance
    this.$root.$nuxt = this
    // add vm.$nuxt to child instances
    Vue.prototype.$nuxt = this
    // add to window so we can listen when ready
    if (typeof window !== 'undefined') {
      window.$nuxt = this
    }
    // for NUXT.serverRendered = false
    this.$loading = {}
  },
  mounted () {
    this.$loading = this.$refs.loading
  },
  <% } %>
  methods: {
    error (err) {
      err = err || null
      this.err = err || null
      <% if (loading) { %>
      if (this.err && this.$loading) {
        if (this.$loading.fail) this.$loading.fail()
        if (this.$loading.finish) this.$loading.finish()
      }
      <% } %>
      return this.err
    }
  },
  components: {
    NuxtError<%= (loading ? ',\n\t\tNuxtLoading' : '') %>
  }
}
</script>
