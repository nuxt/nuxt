<template>
  <div class="container">
    <h1>Home page 🚀</h1>
    <router-link to="/about">Go to /about</router-link>
  </div>
</template>

<script>
export default {
  head: {
    title: 'Home page 🚀',
    meta: [
      { hid: 'description', name: 'description', content: 'Home page description' }
    ]
  }
}
</script>

<style>
.container {
  text-align: center;
  margin-top: 150px;
  font-size: 20px;
}
</style>
