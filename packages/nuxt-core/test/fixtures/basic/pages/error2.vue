<template>
  <h1>Error page</h1>
</template>

<script>
export default {
  asyncData({ error }) {
    error({ message: 'Custom error' })
  }
}
</script>
