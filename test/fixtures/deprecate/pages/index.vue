<template>
  <div>
    <h1>Home page</h1>
    <nuxt-link to="/about">About page</nuxt-link>
  </div>
</template>

<script>
export default {
  // context.isServer and context.isClient has been deprecated
  fetch({ isServer, isClient }) {}
}
</script>
