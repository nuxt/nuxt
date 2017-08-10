<template>
  <div id="__nuxt">
    <% if (loading) { %><nuxt-loading ref="loading"></nuxt-loading><% } %>
    <component v-if="layout" :is="nuxt.err ? 'nuxt' : layout"></component>
  </div>
</template>

<script>
import Vue from 'vue'
<% if (loading) { %>import NuxtLoading from '<%= (typeof loading === "string" ? loading : "./components/nuxt-loading.vue") %>'<% } %>
<% css.forEach(function (c) { %>
import '<%= relativeToBuild(resolvePath(c.src || c)) %>'
<% }) %>

let layouts = {
<%
var layoutsKeys = Object.keys(layouts);
layoutsKeys.forEach(function (key, i) { %>
  "_<%= key %>": () => import('<%= layouts[key] %>'  /* webpackChunkName: "layouts/<%= key %>" */).then(m => m.default || m)<%= (i + 1) < layoutsKeys.length ? ',' : '' %>
<% }) %>
}

export default {
  head: <%= JSON.stringify(head) %>,
  data: () => ({
    layout: null,
    layoutName: ''
  }),
  <% if (loading) { %>
  mounted () {
    this.$loading = this.$refs.loading
    this.$nuxt.$loading = this.$loading
  },
  <% } %>
  beforeCreate () {
    Vue.util.defineReactive(this, 'nuxt', this.$root.$options._nuxt)
  },
  methods: {
    setLayout (layout) {
      if (!layout || !layouts['_' + layout]) layout = 'default'
      this.layoutName = layout
      let _layout = '_' + layout
      this.layout = layouts[_layout]
      return this.layout
    },
    loadLayout (layout) {
      if (!layout || !layouts['_' + layout]) layout = 'default'
      let _layout = '_' + layout
      if (typeof layouts[_layout] !== 'function') {
        return Promise.resolve(layouts[_layout])
      }
      return layouts[_layout]()
      .then((Component) => {
        layouts[_layout] = Component
        return layouts[_layout]
      })
      .catch((e) => {
        if (this.$nuxt) {
          return this.$nuxt.error({ statusCode: 500, message: e.message })
        }
      })
    }
  },
  components: {
    <%= (loading ? 'NuxtLoading' : '') %>
  }
}
</script>

