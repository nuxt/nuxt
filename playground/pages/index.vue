<template>
  <div>
    <h1>Special state in `window.__NUXT__`</h1>
    <client-only><pre>{{ nuxtState }}</pre></client-only>
  </div>
</template>

<script>
export default {
  data () {
    return {
      nuxtState: null
    }
  },
  fetch () {
    if (process.server) {
      this.$root.context.beforeNuxtRender(({ nuxtState }) => {
        nuxtState.testBefore = true
      })
      this.$root.context.afterNuxtRender(({ nuxtState }) => {
        nuxtState.testAfter = true
      })
    }
  },
  beforeMount () {
    this.nuxtState = window.__NUXT__
  }
}
</script>
