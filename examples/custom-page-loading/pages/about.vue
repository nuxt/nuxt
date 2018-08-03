<template>
  <div class="container">
    <p>About Page</p>
    <nuxt-link to="/">Go to /</nuxt-link>
  </div>
</template>

<script>
export default {
  loading: false,
  asyncData() {
    return new Promise((resolve) => {
      setTimeout(function () {
        resolve({})
      }, 1000)
    })
  },
  mounted () {
    setTimeout(() => {
      // Extend loader for an additional 2s
      this.$nuxt.$loading.finish()
    }, 2000)
  }
}
</script>

<style scoped>
.container {
  font-size: 20px;
  text-align: center;
  padding-top: 100px;
}
</style>
