<template>
  <div>
    <h1>{{ name }}</h1>
    <p>{{ loaded }}</p>
  </div>
</template>

<script>
export default {
  loading: false,
  asyncData () {
    return new Promise((resolve) => {
      setTimeout(() => resolve({
        loaded: false,
        name: 'Nuxt.js'
      }), 300)
    })
  },
  mounted () {
    this.$nuxt.$loading.finish()
    setTimeout(() => {
      this.$nuxt.$loading.start()
      this.loaded = true
    }, 1500)
  }
}
</script>
