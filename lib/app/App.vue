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

let resolvedLayouts = {}

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
      if (!layout || !resolvedLayouts['_' + layout]) layout = 'default'
      this.layoutName = layout
      let _layout = '_' + layout
      this.layout = resolvedLayouts[_layout]
      return this.layout
    },
    loadLayout (layout) {
      if (!layout || !(layouts['_' + layout] || resolvedLayouts['_' + layout])) layout = 'default'
      let _layout = '_' + layout
      if (resolvedLayouts[_layout]) {
        return Promise.resolve(resolvedLayouts[_layout])
      }
      return layouts[_layout]()
      .then((Component) => {
        resolvedLayouts[_layout] = Component
        delete layouts[_layout]
        return resolvedLayouts[_layout]
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

