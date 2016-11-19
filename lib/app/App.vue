<template>
  <div id="__nuxt">
    <% if (loading) { %><nuxt-loading ref="loading"></nuxt-loading><% } %>
    <router-view v-if="!err"></router-view>
    <nuxt-error v-if="err" :error="err"></nuxt-error>
  </div>
</template>

<script>
import NuxtError from '<%= components.ErrorPage %>'
<% if (loading) { %>import NuxtLoading from '<%= (typeof loading === "string" ? loading : "./components/nuxt-loading.vue") %>'<% } %>

export default {
  data () {
    return {
      err: null
    }
  },
  <% if (loading) { %>
  created () {
    this.$loading = {} // for NUXT.serverRendered = false
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
  },
  head: <%= JSON.stringify(head) %>
}
</script>

<% css.forEach(function (c) { %>
<style src="<%= (typeof c === 'string' ? c : c.src) %>" lang="<%= (c.lang ? c.lang : 'css') %>"></style>
<% }) %>
