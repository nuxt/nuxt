<template>
  <h1>Special state in `window.__NUXT__`</h1>
</template>

<script>
export default {
  middleware ({ afterNuxtRender }) {
    if (process.server) {
      afterNuxtRender(({ nuxtState }) => {
        nuxtState.testAfter = true
      })
    }
  }
}
</script>
