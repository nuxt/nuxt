<template>
  <p>Never displayed</p>
</template>

<script>
export default {
  fetch({ error }) {
    error({ message: 'Nuxt Error', statusCode: 200 })
  }
}
</script>
