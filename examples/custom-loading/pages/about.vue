<template>
  <div class="container">
    <p>About Page</p>
    <NuxtLink to="/">
      Go to /
    </NuxtLink>
  </div>
</template>

<script>
export default {
  asyncData () {
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
