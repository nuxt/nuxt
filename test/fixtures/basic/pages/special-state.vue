<template>
  <h1>Special state in `window.__NUXT__`</h1>
</template>

<script>
export default {
  fetch ({ isServer, beforeNuxtRender }) {
    if (isServer) {
      beforeNuxtRender(({ nuxtState }) => {
        nuxtState.test = true
      })
    }
  }
}
</script>
