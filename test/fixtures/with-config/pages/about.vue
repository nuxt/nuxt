<template>
  <div>
    <h1>About page</h1>
    <nuxt-link to="/">Home page</nuxt-link>
  </div>
</template>

<script>
export default {
  layout: 'custom',
  asyncData({ route }) {
    return { meta: route.meta || 'empty-meta' }
  }
}
</script>
