<template>
  <div class="container">
    <p>About Page</p>
    <p class="link" @click="goToFinal">Go to /final</p>
  </div>
</template>

<script>
export default {
  loading: false,
  mounted() {
    setTimeout(() => {
      // Extend loader for an additional 5s
      this.$nuxt.$loading.finish()
    }, 5000)
  },
  methods: {
    goToFinal() {
      // Start loader immediately
      this.$nuxt.$loading.start()
      // Actually change route 5s later
      setTimeout(() => {
        this.$router.push('/final')
      }, 5000)
    }
  }
}
</script>

<style scoped>
.link {
  cursor: pointer;
  text-decoration: underline;
}
.container {
  font-size: 20px;
  text-align: center;
  padding-top: 100px;
}
</style>
