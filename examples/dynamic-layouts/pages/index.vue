<template>
  <div class="container">
    <h1>Welcome!</h1>
    <nuxt-link to="/about">About page</nuxt-link>
  </div>
</template>

<script>
export default {
  layout: ({ isMobile }) => isMobile ? 'mobile' : 'default'
}
</script>
