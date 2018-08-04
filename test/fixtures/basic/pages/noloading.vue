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
  mounted() {
    setTimeout(() => this.$nuxt.$loading.finish(), 1500)
  }
}
</script>
