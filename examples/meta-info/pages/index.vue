<template>
  <div class="container">
    <h1>Home page 🚀</h1>
    <nuxt-link to="/about">About page</nuxt-link>
  </div>
</template>

<script>
export default {
  head: {
    title: 'Home page 🚀',
    meta: [
      { hid: 'description', name: 'description', content: 'Home page description' }
    ],
    script: [
      { src: '/head.js' },
      // Supported since 1.0
      { src: '/body.js', body: true },
      { src: '/defer.js', defer: undefined }
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
