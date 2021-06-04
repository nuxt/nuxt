<template>
  <div>
    <h1>Special state in `window.__NUXT__`</h1>
    <client-only><pre>{{ nuxtState }}</pre></client-only>
  </div>
</template>

<script>
 default {
  data () {
    
 {
      nuxtState: null
    }
  },
  fetch () {
     (process.server) {
      this.$root.context.beforeSerialize((nuxtState) => {
        nuxtState.beforeSerialize  true
      })
    }
  },
  beforeMount () {
    this.nuxtState  window.__NUXT__
  }
}
</script>
