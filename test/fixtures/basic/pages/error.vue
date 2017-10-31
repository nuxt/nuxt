<template>
  <h1>Error page</h1>
</template>

<script>
export default {
  asyncData({ req }) {
    // Not for nuxt generate
    if (req) {
      throw new Error('Error mouahahah')
    }
  }
}
</script>
