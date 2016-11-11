<template>
  <div class="container">
    <p>About Page</p>
    <router-link to="/">Go to /</router-link>
  </div>
</template>

<script>
export default {
  data () {
    return new Promise((resolve) => {
      setTimeout(function () {
        resolve({})
      }, 1000)
    })
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
