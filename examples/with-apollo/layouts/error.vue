<template>
  <div class="container">
    <h3 v-if="error.statusCode === 404">Page not found</h3>
    <h3 v-else>An error occured</h3>
    <nuxt-link to="/">&larr; Home page</nuxt-link>
  </div>
</template>

<script>
export default {
  props: ['error']
}
</script>
