<template>
  <nuxt-container>
    <component :is="layout"></component>
  </nuxt-container>
</template>

<script>
let layouts = {
<%
var layoutsKeys = Object.keys(layouts);
layoutsKeys.forEach(function (key, i) { %>
  _<%= key %>: require('<%= layouts[key] %>')<%= (i + 1) < layoutsKeys.length ? ',' : '' %>
<% }) %>
}

export default {
  data () {
    return { layout: layouts._default }
  },
  methods: {
    setLayout (layout) {
      if (!layout || !layouts['_' + layout]) layout = 'default'
      this.layout = layouts['_' + layout]
      return layout
    }
  }
}
</script>
