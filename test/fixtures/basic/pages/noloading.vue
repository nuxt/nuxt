<template>
  <p>{{ name }}</p>
</template>

<script>
export default {
  loading: false,
  asyncData() {
    return new Promise((resolve) => {
      setTimeout(() => resolve({ name: 'Nuxt.js' }), 10)
    })
  },
  watch: {
    $route(to) {
      if (to.path === '/stateless') {
        this.$nuxt.$loading.start()
      }
    }
  },
  mounted() {
    setTimeout(() => this.$nuxt.$loading.finish(), 1500)
  }
}
</script>
