<template>
  <div class="container">
    <h1>Home page</h1>
    <p><nuxt-link to="/about">About page</nuxt-link></p>
    <p><nuxt-link to="/users">Lists of users</nuxt-link></p>
    <p><nuxt-link to="/users-2">Lists of users #2 (with `watch`)</nuxt-link></p>
  </div>
</template>

<script>
export default {
  head: {
    title: 'Home'
  }
}
</script>
