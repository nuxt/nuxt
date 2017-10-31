<template>
  <div class="container">
    <img src="~static/nuxt-black.png" />
    <h2>Thank you for testing nuxt.js</h2>
    <p>Loaded from the {{ name }}</p>
    <p><nuxt-link to="/">Back home</nuxt-link></p>
  </div>
</template>

<script>
export default {
  asyncData({ req }) {
    return {
      name: req ? 'server' : 'client'
    }
  }
}
</script>

<style scoped>
.container {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 100%;
  background: black;
  color: white;
  font-family: "Lucida Console", Monaco, monospace;
  padding-top: 130px;
  text-align: center;
}
a {
  color: silver;
}
</style>
