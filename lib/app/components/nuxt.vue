<template>
  <div>
    <% if (loading) { %><nuxt-loading ref="loading"></nuxt-loading><% } %>
    <nuxt-child v-if="!nuxt.err"></nuxt-child>
    <nuxt-error v-if="nuxt.err" :error="nuxt.err"></nuxt-error>
  </div>
</template>

<script>
import Vue from 'vue'
import NuxtChild from './nuxt-child'
import NuxtError from '<%= components.ErrorPage %>'
<% if (loading) { %>import NuxtLoading from '<%= (typeof loading === "string" ? loading : "./nuxt-loading.vue") %>'<% } %>

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
    // add to window so we can listen when ready
    if (typeof window !== 'undefined') {
      window.$nuxt = this
    }
    // Add $nuxt.error()
    this.error = this.$root.error
  },
  <% if (loading) { %>
  mounted () {
    this.$loading = this.$refs.loading
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
    NuxtError<%= (loading ? ',\n    NuxtLoading' : '') %>
  }
}
</script>
