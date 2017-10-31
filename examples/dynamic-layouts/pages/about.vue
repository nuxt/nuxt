<template>
  <div>
    <p>Hi from {{ name }}</p>
    <nuxt-link to="/">Home page</nuxt-link>
  </div>
</template>

<script>
export default {
  layout: ({ isMobile }) => isMobile ? 'mobile' : 'default',
  asyncData({ req }) {
    return {
      name: req ? 'server' : 'client'
    }
  }
}
</script>
