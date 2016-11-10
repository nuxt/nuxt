<template>
  <div class="container">
    <img src="../static/nuxt-square.png" />
    <h2>Thank you for testing nuxt.js</h2>
    <p><router-link to="/">Back home</router-link></p>
  </div>
</template>

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
