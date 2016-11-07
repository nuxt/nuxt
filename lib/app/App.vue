<template>
  <div id="app">
    <% if (loading) { %><loading ref="loading"></loading><% } %>
    <router-view v-if="!err"></router-view>
    <error-page v-if="err" :error="err"></error-page>
  </div>
</template>

<script>
import ErrorPage from '<%= components.ErrorPage %>'
<% if (loading) { %>import Loading from '<%= (typeof loading === "string" ? loading : "./components/Loading.vue") %>'<% } %>

export default {
  data () {
    return {
      err: null
    }
  },
  <% if (loading) { %>
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
        this.$loading.fail && this.$loading.fail()
      }
      <% } %>
      return this.err
    }
  },
  components: {
    ErrorPage
  }
}
</script>
