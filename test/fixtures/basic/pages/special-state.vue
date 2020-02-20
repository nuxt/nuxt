<template>
  <h1>Special state in `window.__NUXT__`</h1>
</template>

<script>
export default {
  middleware ({ beforeNuxtRender }) {
    if (process.server) {
      beforeNuxtRender(({ nuxtState }) => {
        nuxtState.test = true
      })
    }
  }
}
</script>
