<template>
  <div>
    <p>Hi from {{ name }}</p>
    <nuxt-link to="/">Home page</nuxt-link>
  </div>
</template>

<script>
export default {
  layout: 'dark',
  asyncData({ req }) {
    return {
      name: req ? 'server' : 'client'
    }
  }
}
</script>
