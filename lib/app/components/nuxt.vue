<template>
  <div>
    <% if (loading) { %><nuxt-loading ref="loading"></nuxt-loading><% } %>
    <transition mode="out-in">
      <router-view v-if="!nuxt.err"></router-view>
      <nuxt-error v-if="nuxt.err" :error="nuxt.err"></nuxt-error>
    </transition>
  </div>
</template>

<script>
import Vue from 'vue'
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
    NuxtError<%= (loading ? ',\n\t\tNuxtLoading' : '') %>
  }
}
</script>
