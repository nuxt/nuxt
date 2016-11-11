<template>
  <div class="container">
    <p>Hello {{ name }}!</p>
    <router-link to="/about">Go to /about</router-link>
  </div>
</template>

<script>
export default {
  data () {
    return new Promise((resolve) => {
      setTimeout(function () {
        resolve({ name: 'world' })
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
