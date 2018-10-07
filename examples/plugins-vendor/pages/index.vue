<template>
  <div class="container">
    <p><button @click="showLoginError">Notif me!</button></p>
    <p>Home - <nuxt-link to="/about">About</nuxt-link></p>
  </div>
</template>

<script>
let miniToastr
if (process.client) {
  miniToastr = require('mini-toastr')
}

export default {
  mounted() {
    miniToastr.init()
  },
  notifications: {
    showLoginError: {
      title: 'Welcome!',
      message: 'Hello from nuxt.js',
      type: 'info'
    }
  }
}
</script>

<style>
.container {
  text-align: center;
  padding-top: 100px;
  font-family: sans-serif;
}
</style>
