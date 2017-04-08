<template>
  <div>
    <p>Hi from {{ name }}</p>
    <nuxt-link to="/">Home page</nuxt-link>
  </div>
</template>

<script>
export default {
  asyncData ({ req, isServer }) {
    return {
      name: req ? 'server' : 'client'
    }
  }
}
</script>
