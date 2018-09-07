<template>
  <div>
    <h1>This is secret page.</h1>
    <nuxt-link to="/">Back home</nuxt-link>
  </div>
</template>

<script>
export default {
  middleware: 'authenticated'
}
</script>
