<template>
  <h1>Special state in `window.__NUXT__`</h1>
</template>

<script>
 default {
  middleware ({ beforeNuxtRender }) {
     (process.server) {
      beforeNuxtRender(({ nuxtState }) => {
        nuxtState.beforeNuxtRender = true
      })
    }
  }
}
</script>
